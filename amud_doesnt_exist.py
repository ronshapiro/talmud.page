class AmudDoesntExistException(Exception):
    def __init__(self, masechet, amudim):
        self._masechet = masechet
        self._amudim = amudim

    def message(self):
        if len(self._amudim) is 1:
            return f"{self._masechet} {self._amudim[0]} doesn't exist"
        else:
            parts = [f"{self._masechet} {self._amudim[0]}"]
            for amud in self._amudim[1:-1]:
                parts.append(f", {amud}")
            parts.append(f" and {self._amudim[-1]} don't exist")
            return "".join(parts)
