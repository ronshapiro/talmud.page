import books

books = books.Books()
t = books.gemara("Berakhot")["2a"]
r = books.rashi("Berakhot")["2a"]

for i in range(len(t)):
    print(t[i])
    if i < len(r):
        for r_x in r[i]:
            print("-- %s" % r_x)
    print("\n\n\n\n\n")
