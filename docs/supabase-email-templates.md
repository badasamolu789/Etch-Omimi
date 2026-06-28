# Supabase Auth Email Templates

Use these in Supabase Dashboard > Authentication > Emails.

## Confirm Signup

Subject:

```text
Confirm your Etch account
```

Body:

```html
<div style="margin:0;padding:0;background:#f9f9f7;font-family:Inter,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f9f9f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d4dbc2;border-radius:24px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 12px;">
              <p style="margin:0 0 12px;color:#4a5433;font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">Etch by OMIMI</p>
              <h1 style="margin:0;color:#1a1a1a;font-size:30px;line-height:1.1;">Confirm your account</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 4px;">
              <p style="margin:0;color:#555c4a;font-size:16px;line-height:1.7;">
                Welcome to Etch, the creative IP marketplace built for protected discovery, curated listings, and escrow-ready deals.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#99a96a;color:#1a1a1a;text-decoration:none;font-size:14px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;padding:16px 22px;border-radius:999px;">
                Confirm email
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;">
              <p style="margin:0;color:#6a6f61;font-size:14px;line-height:1.7;">
                If you did not create an Etch account, you can ignore this email.
              </p>
              <p style="margin:18px 0 0;color:#4a5433;font-size:13px;line-height:1.6;">
                Your work stays protected with watermarked previews until terms are agreed.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
```

## Redirect URLs

In Supabase Dashboard > Authentication > URL Configuration, set the local site URL and add redirect URLs.

Site URL while testing with VS Code Live Server:

```text
http://127.0.0.1:5500
```

Redirect URLs while testing locally:

```text
http://127.0.0.1:5500
http://127.0.0.1:5500/auth/confirm.html
http://localhost:5500
http://localhost:5500/auth/confirm.html
```

If you use another local port, add that origin and `/auth/confirm.html` too.

## Custom SMTP Settings

In Supabase Dashboard > Authentication > Emails > SMTP, the host must be a hostname only. Do not include `https://`, `http://`, or the port in the host field.

For your current setup, this is the issue shown in the Auth Logs:

```text
Dial tcp: address https://etchbyomimi.com:465: too many colons in address
```

Use this shape instead:

```text
Sender email address: noreply@etchbyomimi.com
Sender name: Etch by OMIMI
Host: etchbyomimi.com
Port: 465
```

If Supabase logs this error:

```text
tls: failed to verify certificate: x509: certificate is not valid for any names, but wanted to match etchbyomimi.com
```

then `etchbyomimi.com` is not the correct SMTP host for SSL/TLS. Use the exact SMTP hostname from your mail provider instead. It is often different from the website domain.

If your mail provider gave you a real SMTP server, use that hostname instead, for example:

```text
smtp.yourmailprovider.com
mail.etchbyomimi.com
```

Common working shapes:

```text
Host: smtp.gmail.com
Port: 587
Security: STARTTLS/TLS
```

```text
Host: smtp.zoho.com
Port: 465
Security: SSL
```

```text
Host: mail.yourdomain.com
Port: 465
Security: SSL
```

The host should never look like this:

```text
https://etchbyomimi.com
https://etchbyomimi.com:465
```
