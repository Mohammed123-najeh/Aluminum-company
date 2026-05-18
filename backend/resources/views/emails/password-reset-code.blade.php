<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Password reset code</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;padding:32px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="520" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
                    <tr>
                        <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 32px;color:#ffffff;">
                            <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.85;">Aluminum Pearl Co.</p>
                            <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;">Reset your password</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px 32px 8px 32px;">
                            <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#334155;">
                                Hi {{ $userName ?: 'there' }},
                            </p>
                            <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#334155;">
                                Use the code below to reset your password. It is valid for
                                <strong>{{ $expiresInMinutes }} minutes</strong>.
                            </p>
                            <div style="text-align:center;margin:18px 0 22px;">
                                <div style="display:inline-block;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:36px;font-weight:700;letter-spacing:0.4em;padding:16px 28px;background:#eef2ff;color:#3730a3;border-radius:12px;border:1px solid #c7d2fe;">
                                    {{ $code }}
                                </div>
                            </div>
                            <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#64748b;">
                                If you did not request a password reset, you can safely ignore this email — your password will stay the same.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:16px 32px 28px 32px;border-top:1px solid #e2e8f0;">
                            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                                Sent automatically by the Aluminum Pearl Co. management system.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
