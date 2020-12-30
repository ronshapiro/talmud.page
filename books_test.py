from books import BOOKS

class Subject(object):
    def __init__(self, query):
        self.query = query

    def is_extracted_to(self, title, start, end=None):
        query_result = BOOKS.parse(self.query)
        errors = []
        if query_result.book_name != title:
            errors.append(
                "expected title to be %s, but was %s" % (title, query_result.book_name))
        if query_result.start != start:
            errors.append("expected start to be %s, but was %s" % (start, query_result.start))
        if query_result.end != end:
            errors.append("expected end to be %s, but was %s" % (end, query_result.end))

        if len(errors):
            raise AssertionError("\n".join(errors))

    def doesnt_parse(self):
        try:
            BOOKS.parse(self.query)
        except Exception:
            return
        raise AssertionError("%s successfully parsed (%s), but was expected not to")

def assert_that(query):
    return Subject(query)

assert_that("Brachot 20a").is_extracted_to("Berakhot", "20a")
assert_that("Brachot 20b").is_extracted_to("Berakhot", "20b")

assert_that("Brachot 20.").is_extracted_to("Berakhot", "20a")
assert_that("Brachot 20:").is_extracted_to("Berakhot", "20b")

assert_that("Brachot 20").is_extracted_to("Berakhot", "20a", "20b")

assert_that("Shabbat ק.").is_extracted_to("Shabbat", "100a")
assert_that("Shabbat קכ.").is_extracted_to("Shabbat", "120a")
assert_that("Shabbat קכג.").is_extracted_to("Shabbat", "123a")
assert_that("Shabbat קג.").is_extracted_to("Shabbat", "103a")

assert_that("Brachot 2-3a").is_extracted_to("Berakhot", "2a", "3a")
assert_that("Brachot 2 - 3a").is_extracted_to("Berakhot", "2a", "3a")
assert_that("Brachot 2 to 3a").is_extracted_to("Berakhot", "2a", "3a")
assert_that("Brachot 2 to 3").is_extracted_to("Berakhot", "2a", "3b")
assert_that("Brachot 2b to 3").is_extracted_to("Berakhot", "2b", "3b")

assert_that("Brachot 2ab").is_extracted_to("Berakhot", "2a", "2b")

assert_that("ברכות ב").is_extracted_to("Berakhot", "2a", "2b")
assert_that("ברכות ב.").is_extracted_to("Berakhot", "2a")
assert_that("ברכות ב:").is_extracted_to("Berakhot", "2b")
assert_that("     Brachot     2a     to     2b").is_extracted_to("Berakhot", "2a", "2b")

assert_that("Rosh Hashana 2a").is_extracted_to("Rosh Hashanah", "2a")

assert_that("Brachot ככ").doesnt_parse()
assert_that("Not Shabbat 2a").doesnt_parse()
assert_that("Not Shabbat 2a").doesnt_parse()

assert_that("Shabbat 2c").doesnt_parse()
assert_that("Shabbat 2c-3a").doesnt_parse()
assert_that("Shabbat 2b-3c").doesnt_parse()
