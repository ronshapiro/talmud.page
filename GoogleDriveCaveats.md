# Google Drive Integration

[talmud.page] uses Google Docs to save your notes as your learn. As notes are added, the document is updated. Those notes will appear as comments on the texts on [talmud.page], and you can always open the document to view all of your notes.

## Nitty gritty details

Whenever you start taking notes on a masechet, a document named "talmud.page <masechet-name> notes" is created. You can change the document title to another name if you'd like.

Whenever a note is taken on a new amud, a header with that amud name is created, followed by the text of the note. Future notes will be inserted in the order that the gemara they are commenting on appears on the amud. (Notes on commentaries will use the gemara text that they themselves are commenting on for ordering purposes, so if you comment on Rashi and then the Gemara text itself, the comment on Rashi will appear first.)

The text of each note is tagged with the text that it is referencing. That's how [talmud.page] can remember where that comment should be displayed later on. Because of this, if you add text on a new line in the Google Doc, [talmud.page] doesn't know that this text is relevant! If you'd like to add a new note, do so from [talmud.page] directly. You _can_ add a newline in the middle of an existing comment if you'd like, though that will still remain as _one_ comment with multiple lines. Note that even reordering notes is considered two separate add+delete commands in Google Docs, and will cause your note to be lost.

Because notes on commentaries are inserted based on the Gemara they comment on, there is no place in the Google doc to see all notes on a particular commentary. This is most relevant for pesukim that return multiple times throughout a masechet. Note that because they are tagged with the pasuk itself, [talmud.page] will display _all_ of them when viewing the pasuk on the site. Because notes are saved per-masechet, [talmud.page] will only show notes taken on that pasuk _in the current masechet_. It is probably possible to sync all of these notes, so if that's something you'd like, email feedback@talmud.page.

If you'd like another structure of all of your notes on a particular masechet or cross-masechtot, email feedback@talmud.page and we can discuss implementing what you'd like.

## Why not use a "regular" database?

- It's hard to build a better way to view and edit text than Google Docs.
  - Want to remove a comment? Just delete the text. Want to make an edit? Go right ahead.
  - Share your notes document with friends to collaborate
- By using Google Docs as a database, you own your data. [talmud.page] can't access any of it unless you are browsing the site, and you can always revoke acccess or move/delete the content anytime.
- You can use Google Drive's search feature to search your notes

[talmud.page]: https://talmud.page
