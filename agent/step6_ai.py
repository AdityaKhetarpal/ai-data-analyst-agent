"""
STEP 6 - THE AI THAT WRITES THE SQL
-----------------------------------
What:  One function, write(system, messages) -> text, with two possible "brains":
         - Claude (if ANTHROPIC_API_KEY is set): strongest, costs a little per question
         - a FREE open-source coding model (Qwen2.5-Coder 1.5B) that runs on a normal computer, no key needed
Why:   The rest of the agent doesn't care which brain is used. The free one means the project can be
       tested and demoed without any paid account (GitHub runs the step 8 test with it every week).
       No model is trained here: both are used as they come.
"""
import functools
import os
import re

import settings


def claude_writer(model=settings.CLAUDE_MODEL):
    import anthropic
    client = anthropic.Anthropic()          # reads ANTHROPIC_API_KEY from the environment, never from code

    def write(system, messages):
        reply = client.messages.create(model=model, max_tokens=700, temperature=0, system=system, messages=messages)
        return "".join(block.text for block in reply.content if block.type == "text")
    write.name = f"Claude ({model})"
    return write


@functools.lru_cache(maxsize=1)
def _load_free_model(name):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(name)
    model = AutoModelForCausalLM.from_pretrained(name, dtype=torch.float32)   # float32 is fastest on ordinary CPUs
    model.eval()
    return tokenizer, model


def free_writer(name=settings.FREE_MODEL):
    def write(system, messages):
        import torch
        tokenizer, model = _load_free_model(name)
        chat = [{"role": "system", "content": system}] + messages
        inputs = tokenizer.apply_chat_template(chat, add_generation_prompt=True, return_tensors="pt", return_dict=True)
        with torch.no_grad():
            output = model.generate(**inputs, max_new_tokens=400, do_sample=False)
        return tokenizer.decode(output[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
    write.name = f"free model ({name.split('/')[-1]})"
    return write


def pick_writer():
    return claude_writer() if os.environ.get("ANTHROPIC_API_KEY") else free_writer()


def read_reply(text):
    """Turn the AI's reply into ('clarify', question) or ('sql', query)."""
    text = (text or "").strip()
    match = re.search(r"CLARIFY:\s*(.+)", text)
    if match and "select" not in text[:match.start()].lower():
        return "clarify", match.group(1).strip().splitlines()[0]
    block = re.search(r"```(?:sql|sqlite)?\s*(.*?)```", text, re.S | re.I)
    sql = block.group(1) if block else text
    return "sql", sql.strip()
