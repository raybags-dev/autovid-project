import config
import resend

resend.api_key = getattr(config, "RESEND_API_KEY", "")

# Use onboarding@resend.dev until async-mode.com is verified in the Resend dashboard.
# To use your own address: Resend → Domains → Add async-mode.com → add the DNS records in Cloudflare.
_FROM = "AutoVid <onboarding@resend.dev>"
_BRAND = "AutoVid"
_SITE = "https://async-mode.com"


def _send(to: str, subject: str, html: str) -> bool:
    if not resend.api_key:
        print(f"[email] RESEND_API_KEY not set — skipping send to {to}")
        return False
    try:
        r = resend.Emails.send({
            "from": _FROM,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        sent_id = r.get("id") if isinstance(r, dict) else getattr(r, "id", None)
        if sent_id:
            print(f"[email] Sent to {to} — id: {sent_id}")
            return True
        print(f"[email] Resend returned no id for {to}: {r}")
        return False
    except Exception as exc:
        print(f"[email] Failed to send to {to}: {exc}")
        return False


def _base(body: str) -> str:
    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                max-width:560px;margin:0 auto;padding:40px 24px;background:#ffffff;color:#111111">
      {body}
      <hr style="border:none;border-top:1px solid #e8e8e8;margin:32px 0 24px">
      <p style="font-size:12px;color:#999;margin:0">
        <a href="{_SITE}" style="color:#4f46e5;text-decoration:none">{_SITE}</a>
        &nbsp;·&nbsp; You received this because you signed up for {_BRAND}.
      </p>
    </div>"""


def send_registration_confirmation(email: str) -> bool:
    html = _base(f"""
      <h2 style="margin:0 0 12px;font-size:22px;color:#111">Thanks for signing up</h2>
      <p style="color:#444;line-height:1.7;margin:0 0 12px">
        We received your request to access <strong>{_BRAND}</strong> on async-mode.com.
      </p>
      <p style="color:#444;line-height:1.7;margin:0">
        Your account is under review. You'll get another email as soon as it's been approved —
        usually within 24 hours.
      </p>""")
    return _send(email, f"{_BRAND} — registration received", html)


def send_approval_notification(email: str) -> bool:
    html = _base(f"""
      <h2 style="margin:0 0 12px;font-size:22px;color:#111">Your account is approved ✓</h2>
      <p style="color:#444;line-height:1.7;margin:0 0 24px">
        Your request for <strong>{_BRAND}</strong> access has been approved.
        You can now log in and start using the platform.
      </p>
      <p style="margin:0">
        <a href="{_SITE}/login"
           style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;
                  border-radius:7px;text-decoration:none;font-weight:600;font-size:14px">
          Log in to your workspace →
        </a>
      </p>""")
    return _send(email, f"{_BRAND} — your account is approved", html)


def send_rejection_notification(email: str) -> bool:
    html = _base(f"""
      <h2 style="margin:0 0 12px;font-size:22px;color:#111">Access request update</h2>
      <p style="color:#444;line-height:1.7;margin:0 0 12px">
        Unfortunately your request for <strong>{_BRAND}</strong> access was not approved at this time.
      </p>
      <p style="color:#444;line-height:1.7;margin:0">
        If you think this is a mistake, reply to this email and we'll take another look.
      </p>""")
    return _send(email, f"{_BRAND} — access request update", html)


def send_trial_expiry_warning(email: str, expires_at: str) -> bool:
    html = _base(f"""
      <h2 style="margin:0 0 12px;font-size:22px;color:#111">Your trial expires soon</h2>
      <p style="color:#444;line-height:1.7;margin:0 0 12px">
        Your <strong>{_BRAND}</strong> trial access expires in less than 24 hours.
        Log in now to use your remaining video credits before they expire.
      </p>
      <p style="margin:0">
        <a href="{_SITE}/dashboard"
           style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;
                  border-radius:7px;text-decoration:none;font-weight:600;font-size:14px">
          Go to your workspace →
        </a>
      </p>
      <p style="color:#666;line-height:1.7;margin:16px 0 0;font-size:13px">
        Want to keep access after your trial? Reply to this email to discuss upgrade options.
      </p>""")
    return _send(email, f"{_BRAND} — your trial expires in 24 hours", html)


def send_trial_expired_notification(email: str) -> bool:
    html = _base(f"""
      <h2 style="margin:0 0 12px;font-size:22px;color:#111">Your trial has ended</h2>
      <p style="color:#444;line-height:1.7;margin:0 0 12px">
        Your 24-hour trial for <strong>{_BRAND}</strong> has ended.
        Your videos and data remain safe — reply to this email to discuss upgrading to full access.
      </p>
      <p style="color:#444;line-height:1.7;margin:0">
        Thank you for trying {_BRAND}. We hope to have you back as a full member.
      </p>""")
    return _send(email, f"{_BRAND} — your trial has ended", html)


def send_video_ready_notification(email: str, title: str) -> bool:
    safe_title = title or "Your video"
    html = _base(f"""
      <h2 style="margin:0 0 12px;font-size:22px;color:#111">Your video is ready</h2>
      <p style="color:#444;line-height:1.7;margin:0 0 24px">
        <strong>{safe_title}</strong> has finished generating. Log in to your workspace to watch and download it.
      </p>
      <p style="margin:0">
        <a href="{_SITE}/dashboard"
           style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;
                  border-radius:7px;text-decoration:none;font-weight:600;font-size:14px">
          View your video →
        </a>
      </p>""")
    return _send(email, f"{_BRAND} — your video is ready", html)


def send_account_deletion_requested(email: str, deletion_time: str) -> bool:
    html = _base(f"""
      <h2 style="margin:0 0 12px;font-size:22px;color:#111">Account deletion requested</h2>
      <p style="color:#444;line-height:1.7;margin:0 0 16px">
        We received a request to permanently delete your account and all associated data.
      </p>
      <p style="color:#444;line-height:1.7;margin:0 0 24px">
        Your account is scheduled for deletion on <strong>{deletion_time}</strong>.
        If you change your mind, log in before that time and cancel the deletion from your Account settings.
      </p>
      <p style="margin:0 0 24px">
        <a href="{_SITE}/dashboard"
           style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;
                  border-radius:7px;text-decoration:none;font-weight:600;font-size:14px">
          Cancel deletion →
        </a>
      </p>
      <p style="color:#999;font-size:12px;margin:0">
        If you did not request this, contact us immediately at help@async-mode.com.
      </p>""")
    return _send(email, f"{_BRAND} — account deletion scheduled", html)
