/** Small line icons for the car screen, drawn on a 24-unit square. Each is the usual sign for its thing. */
const drawn: Record<string, string> = {
  temperature: '<path d="M10 4a2 2 0 0 1 4 0v9.2a4.5 4.5 0 1 1-4 0z"/><path d="M12 9v7"/><circle cx="12" cy="17" r="1.6" fill="currentColor"/>',
  fan: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10.2C11 6 13 3 16 4.2c1.6 2.6-.6 5-4 6zM13.6 12.9c4.2-1 7.2 1 6 4-2.6 1.6-5-.6-6-4zM10.4 12.9c-1 4.2-4 6.2-6 4.3-.6-3 1.6-5.4 6-4.3z"/>',
  cold: '<path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5"/>',
  volume: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  track: '<circle cx="7.5" cy="17" r="2.5"/><circle cx="17.5" cy="15" r="2.5"/><path d="M10 17V6l10-2v11"/>',
  seat: '<path d="M8 3.5c2 0 2.6 1 2.9 3l1 6.5H17a2.5 2.5 0 0 1 0 5H9.5a3 3 0 0 1-3-2.6L5.2 6.6C5 4.6 6 3.5 8 3.5zM9 18v2.5M17 18v2.5"/>',
  map: '<path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.4"/>',
  car: '<path d="M4 16v-3.5l1.8-4.6A2.5 2.5 0 0 1 8.1 6.3h7.8a2.5 2.5 0 0 1 2.3 1.6L20 12.5V16M4 12.5h16M3.5 16h17v2.5h-3V16M6.5 16v2.5h-3"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.500 5.700 2 2 0 0 1 6.500 3.500z"/>',
}
export type Icon = keyof typeof drawn
export const icon = (name: string) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawn[name] ?? ''}</svg>`
