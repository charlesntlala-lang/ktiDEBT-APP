let _authenticated = false;

export function isSessionAuthenticated(): boolean {
  return _authenticated;
}

export function setSessionAuthenticated(): void {
  _authenticated = true;
}

export function clearSession(): void {
  _authenticated = false;
}
