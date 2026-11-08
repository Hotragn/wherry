/** The 60-second path for a first-time visitor: Owner, then Phone, then Shop. Shared by server and client code. */
export const STEPS = [
  { href: "/app/owner", n: 1, role: "Owner", line: "you fund the tab", todo: "Get test dollars, pair the phone, lock $40." },
  { href: "/app/phone", n: 2, role: "Phone", line: "pays with no signal", todo: "Find your tab, scan the shop's sticker, pay." },
  { href: "/app/shop", n: 3, role: "Shop", line: "Amara's kiosk", todo: "Check the voucher offline, accept, settle when you're back online." },
] as const;
