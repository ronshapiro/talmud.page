import json

def write_json(file_name, data):
    """Writes `data` to `file_name` with stable output."""
    with open(file_name, "w") as output_file:
        json.dump(data,
                  output_file,
                  indent = 2,
                  ensure_ascii = False,
                  sort_keys = True)
        output_file.write("\n")
