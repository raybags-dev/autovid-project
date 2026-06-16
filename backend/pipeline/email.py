import config
import httpx

_FROM = "noreply@async-mode.com"
_BRAND = "AutoVid"
_SITE = "https://async-mode.com"


def _send(to: str, subject: str, html: str) -> bool:
    key = getattr(config, "RESEND_API_KEY", "")
    if not key:
        print(f"[email] RESEND_API_KEY not set — skipping send to {to}")
        return False
    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={"from": _FROM, "to": [to], "subject": subject, "html": html},
            timeout=10,
        )
        if r.status_code not in (200, 201):
            print(f"[email] Resend error {r.status_code}: {r.text}")
            return False
        return True
    except Exception as exc:
        print(f"[email] Failed to send to {to}: {exc}")
        return False


def _base(body: str) -> str:
    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                max-width:560px;margin:0 auto;padding:40px 24px;
                background:#ffffff;color:#111111">
      {body}
      <hr style="border:none;border-top:1px solid #e8e8e8;margin:32px 0 24px">
      <p style="font-size:12px;color:#888;margin:0">
        <a href="{_SITE}" style="color:#4f46e5;text-decoration:none">{_SITE}</a>
      </p>
    </div>"""


def send_registration_confirmation(email: str) -> bool:
    html = _base(f"""
      <h2 style="margin:0 0 12px;font-size:22px">Thanks for signing up</h2>
      <p style="color:#444;line-height:1.7">
        We received your request to access <strong>{_BRAND}</strong> on async-mode.com.
      </p>
      <p style="color:#444;line-height:1.7">
        Your account is under review. You'll receive another email as soon as it's been approved.
      </p>""")
    return _send(email, f"{_BRAND} — registration received", html)


def send_approval_notification(email: str) -> bool:
    html = _base(f"""
      <h2 style="margin:0 0 12px;font-size:22px">Your account is approved</h2>
      <p style="color:#444;line-height:1.7">
        Your request for <strong>{_BRAND}</strong> access has been approved.
      </p>
      <p style="margin:24px 0">
        <a href="{_SITE}/login"
           style="background:#4f46e5;color:#fff;padding:12px 24px;
                  border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
          Log in now
        </a>
      </p>""")
    return _send(email, f"{_BRAND} — your account is approved", html)


def send_rejection_notification(email: str) -> bool:
    html = _base(f"""
      <h2 style="margin:0 0 12px;font-size:22px">Access request update</h2>
      <p style="color:#444;line-height:1.7">
        Unfortunately your request for <strong>{_BRAND}</strong> access was not approved at this time.
      </p>
      <p style="color:#444;line-height:1.7">
        If you believe this is a mistake, please reply to this email and we'll take another look.
      </p>""")
    return _send(email, f"{_BRAND} — access request update", html)
