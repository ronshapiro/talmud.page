import {v4 as uuid} from "uuid";

export function initializeLocalStorage(): void {
  if (!localStorage.userUuid) {
    localStorage.needsToPickLanguage = true;
    localStorage.userUuid = uuid();
  }
}
