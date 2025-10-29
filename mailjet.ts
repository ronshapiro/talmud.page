import * as Mailjet from "node-mailjet";
import {readUtf8} from "./files";

interface SendParameters {
  to: string;
  cc?: string[];
  subject: string;
  text: string;
  html: string;
}

interface EmailType {
  Email: string;
  Name?: string;
}

function makeEmail(email: string, name: string | undefined = undefined): EmailType {
  const result: EmailType = {Email: email};
  if (name) result.Name = name;
  return result;
}

export async function sendEmail({to, cc, subject, text, html}: SendParameters): Promise<unknown> {
  const client = new Mailjet.Client({
    apiKey: readUtf8("mailjet_api_key"),
    apiSecret: readUtf8("mailjet_api_secret"),
  });

  return client.post('send', { version: 'v3.1' })
    .request({
      Messages: [
        {
          From: makeEmail("mail@talmud.page", "talmud.page"),
          To: [makeEmail(to)],
          CC: (cc ?? []).map(x => makeEmail(x)),
          Subject: subject,
          TextPart: text,
          HTMLPart: html,
        },
      ],
    });
}
