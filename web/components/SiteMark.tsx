// The site logo. Plain shapes, so it needs no font and stays sharp at any size.
// A padlock whose body is a database stack: the agent can read the data and never change it.
export default function SiteMark() {
  return (
    <span className="site-mark" aria-hidden="true">
      <svg viewBox="2 2 28 28">
        <path d="M8 14.5V10.5A8 8 0 0 1 24 10.5V14.5H19.5V10.5A3.5 3.5 0 0 0 12.5 10.5V14.5Z" fill="var(--mark)" />
        <path d="M5.75 15.5a1.5 1.5 0 0 1 1.5-1.5H24.25a1.5 1.5 0 0 1 1.5 1.5V17.4c0 1.7-4.5 2.6-10.75 2.6S5.75 19.1 5.75 17.4Z" fill="var(--mark)" />
        <path d="M5.75 23.5a1.5 1.5 0 0 1 1.5-1.5H24.25a1.5 1.5 0 0 1 1.5 1.5V25.4c0 1.7-4.5 2.6-10.75 2.6S5.75 27.1 5.75 25.4Z" fill="var(--accent-2)" />
      </svg>
    </span>
  );
}
