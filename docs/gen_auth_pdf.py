"""Generate auth-options.pdf for MindAnchor."""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus.flowables import Flowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfgen import canvas as pdfgen_canvas

# ── colours ──────────────────────────────────────────────────────────────────
C_BROWSER  = colors.HexColor("#D0E8F9")   # light blue
C_SERVER   = colors.HexColor("#C8EDD3")   # light green
C_STORAGE  = colors.HexColor("#FFE5B4")   # light orange
C_BORDER   = colors.HexColor("#555555")
C_ARROW    = colors.HexColor("#333333")
C_HEAD_BG  = colors.HexColor("#1F3A5F")
C_HEAD_FG  = colors.white
C_PRO_BG   = colors.HexColor("#EAF7EA")
C_CON_BG   = colors.HexColor("#FFF3F3")
C_ACCENT_A = colors.HexColor("#2E86DE")
C_ACCENT_B = colors.HexColor("#10AC84")
C_ACCENT_C = colors.HexColor("#EE5A24")

W, H = A4  # portrait


# ── helpers ───────────────────────────────────────────────────────────────────
def _box(c, x, y, w, h, fill, label, sublabel=None, font_size=9):
    c.setFillColor(fill)
    c.setStrokeColor(C_BORDER)
    c.setLineWidth(1)
    c.roundRect(x, y, w, h, 6, fill=1, stroke=1)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", font_size)
    if sublabel:
        c.drawCentredString(x + w / 2, y + h / 2 + 5, label)
        c.setFont("Helvetica", font_size - 1)
        c.drawCentredString(x + w / 2, y + h / 2 - 7, sublabel)
    else:
        c.drawCentredString(x + w / 2, y + h / 2 - 4, label)


def _arrow_h(c, x1, x2, mid_y, label="", label_above=True):
    """Horizontal arrow from x1 to x2 at mid_y."""
    c.setStrokeColor(C_ARROW)
    c.setLineWidth(1.2)
    c.line(x1, mid_y, x2, mid_y)
    # arrowhead
    ah = 6
    c.setFillColor(C_ARROW)
    p = c.beginPath()
    p.moveTo(x2, mid_y)
    p.lineTo(x2 - ah, mid_y + 3)
    p.lineTo(x2 - ah, mid_y - 3)
    p.close()
    c.drawPath(p, fill=1, stroke=0)
    if label:
        c.setFont("Helvetica-Oblique", 7.5)
        c.setFillColor(colors.HexColor("#444444"))
        lx = (x1 + x2) / 2
        ly = mid_y + 4 if label_above else mid_y - 12
        c.drawCentredString(lx, ly, label)


def _arrow_v(c, x, y1, y2, label="", label_right=True):
    """Vertical arrow downward from y1 to y2 at x."""
    c.setStrokeColor(C_ARROW)
    c.setLineWidth(1.2)
    c.line(x, y1, x, y2)
    ah = 6
    c.setFillColor(C_ARROW)
    p = c.beginPath()
    p.moveTo(x, y2)
    p.lineTo(x - 3, y2 + ah)
    p.lineTo(x + 3, y2 + ah)
    p.close()
    c.drawPath(p, fill=1, stroke=0)
    if label:
        c.setFont("Helvetica-Oblique", 7.5)
        c.setFillColor(colors.HexColor("#444444"))
        lx = x + 6 if label_right else x - 6
        ly = (y1 + y2) / 2
        if label_right:
            c.drawString(lx, ly, label)
        else:
            c.drawRightString(lx, ly, label)


# ── diagram flowables ─────────────────────────────────────────────────────────
class DiagramA(Flowable):
    """Option A — Static Bearer Token."""
    W, H = 15 * cm, 7 * cm

    def wrap(self, *_): return self.W, self.H

    def draw(self):
        c = self.canv
        bw, bh = 3.8 * cm, 1.1 * cm
        gap = 1.2 * cm
        row_y = self.H - 2.5 * cm    # top row y (bottom of box)

        # Three boxes in a row
        x0 = 0
        x1 = x0 + bw + gap
        x2 = x1 + bw + gap

        _box(c, x0, row_y, bw, bh, C_BROWSER, "Browser / PWA")
        _box(c, x1, row_y, bw, bh, C_SERVER,  "FastAPI", "middleware")
        _box(c, x2, row_y, bw, bh, C_STORAGE, "Env var", "STATIC_TOKEN")

        mid = row_y + bh / 2
        _arrow_h(c, x0 + bw, x1, mid, 'POST /auth  "token: …"')
        _arrow_h(c, x1 + bw, x2, mid, "constant-time compare")

        # Down from middleware: 401 branch
        branch_x = x1 + bw / 2
        _arrow_v(c, branch_x, row_y, row_y - 1.6 * cm, "mismatch?")

        _box(c, x1 - 0.3 * cm, row_y - 2.7 * cm, bw + 0.6 * cm, 0.9 * cm,
             colors.HexColor("#FFD6D6"), "401 Unauthorized")
        _box(c, x1 - 0.3 * cm, row_y - 4.0 * cm, bw + 0.6 * cm, 0.9 * cm,
             C_SERVER, "200 + resource")

        c.setFont("Helvetica-Oblique", 7.5)
        c.setFillColor(colors.HexColor("#444444"))
        c.drawCentredString(branch_x + 1.2 * cm, row_y - 2.0 * cm, "no match")
        c.drawCentredString(branch_x + 1.2 * cm, row_y - 3.2 * cm, "match")

        # Arrows for the two outcomes (short verticals)
        _arrow_v(c, branch_x, row_y - 1.6 * cm, row_y - 1.8 * cm)
        _arrow_v(c, branch_x, row_y - 2.7 * cm, row_y - 3.1 * cm)


class DiagramB(Flowable):
    """Option B — Password Login + JWT."""
    W, H = 15 * cm, 12 * cm

    def wrap(self, *_): return self.W, self.H

    def draw(self):
        c = self.canv
        bw, bh = 3.8 * cm, 1.0 * cm
        gap = 1.1 * cm

        # ── Step 1 label ──────────────────────────────────────────────────────
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(colors.HexColor("#1F3A5F"))
        c.drawString(0, self.H - 0.5 * cm, "Step 1 — Login")

        row1_y = self.H - 1.8 * cm
        x0, x1, x2 = 0, bw + gap, 2 * (bw + gap)

        _box(c, x0, row1_y, bw, bh, C_BROWSER, "Browser")
        _box(c, x1, row1_y, bw, bh, C_SERVER,  "FastAPI")
        _box(c, x2, row1_y, bw, bh, C_STORAGE, "Env: PASSWORD_HASH")

        mid1 = row1_y + bh / 2
        _arrow_h(c, x0 + bw, x1, mid1, 'POST /auth/login {password}')
        _arrow_h(c, x1 + bw, x2, mid1, "bcrypt.verify")

        # sign JWT arrow (down from FastAPI box)
        fx = x1 + bw / 2
        _arrow_v(c, fx, row1_y, row1_y - 1.2 * cm, "sign JWT (HS256, 7d)")
        _box(c, x1 - 0.5 * cm, row1_y - 2.0 * cm, bw + 1.0 * cm, bh,
             C_SERVER, "200 {access_token}")

        # return arrow (left to Browser box bottom area)
        ret_y = row1_y - 1.55 * cm
        _arrow_h(c, x1, x0 + bw, ret_y, "← token returned", label_above=False)

        # localStorage note
        _box(c, x0, row1_y - 3.2 * cm, bw + 0.2 * cm, bh,
             C_STORAGE, "localStorage", "stores JWT")

        _arrow_v(c, x0 + bw / 2, row1_y - 2.0 * cm, row1_y - 2.2 * cm)

        # ── Step 2 label ──────────────────────────────────────────────────────
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(colors.HexColor("#1F3A5F"))
        c.drawString(0, row1_y - 4.2 * cm, "Step 2 — Every protected request")

        row2_y = row1_y - 5.5 * cm
        _box(c, x0, row2_y, bw, bh, C_BROWSER, "Browser")
        _box(c, x1, row2_y, bw, bh, C_SERVER,  "Depends(", "get_current_user)")
        _box(c, x2, row2_y, bw, bh, C_STORAGE, "Env: JWT_SECRET")

        mid2 = row2_y + bh / 2
        _arrow_h(c, x0 + bw, x1, mid2, "GET /systems  Bearer <jwt>")

        vx = x1 + bw / 2
        _arrow_v(c, vx, row2_y, row2_y - 1.1 * cm, "verify sig + expiry")
        _arrow_h(c, x1 + bw, x2, mid2 - 0.3 * cm, "reads secret")

        ok_y = row2_y - 1.9 * cm
        _box(c, x1 - 0.8 * cm, ok_y, bw + 1.6 * cm, bh,
             C_SERVER, "200 + data  /  401 Unauthorized")


class DiagramC(Flowable):
    """Option C — Cloudflare Access."""
    W, H = 15 * cm, 7.5 * cm

    def wrap(self, *_): return self.W, self.H

    def draw(self):
        c = self.canv
        bw, bh = 3.5 * cm, 1.1 * cm
        gap = 1.0 * cm

        row_y = self.H - 2.5 * cm
        x0 = 0
        x1 = x0 + bw + gap
        x2 = x1 + bw + gap

        _box(c, x0, row_y, bw, bh, C_BROWSER, "Browser")
        _box(c, x1, row_y, bw, bh, colors.HexColor("#FFF0CC"),
             "Cloudflare Access", "email OTP / Google")
        _box(c, x2, row_y, bw, bh, C_SERVER,  "Render / Cloud Run", "FastAPI backend")

        mid = row_y + bh / 2
        _arrow_h(c, x0 + bw, x1, mid, "request")
        _arrow_h(c, x1 + bw, x2, mid, "CF injects JWT header")

        # Blocked branch (down from CF)
        cfx = x1 + bw / 2
        _arrow_v(c, cfx, row_y, row_y - 1.5 * cm, "if identity fails")
        _box(c, x1 - 0.3 * cm, row_y - 2.4 * cm, bw + 0.6 * cm, 0.9 * cm,
             colors.HexColor("#FFD6D6"), "Blocked — 403")

        # FastAPI trusts header
        bex = x2 + bw / 2
        _arrow_v(c, bex, row_y, row_y - 1.5 * cm, "trusts CF header", label_right=False)
        _box(c, x2 - 0.2 * cm, row_y - 2.4 * cm, bw + 0.4 * cm, 0.9 * cm,
             C_SERVER, "200 + resource")

        # Note at bottom
        c.setFont("Helvetica-Oblique", 7.5)
        c.setFillColor(colors.HexColor("#555555"))
        c.drawString(0, 0.3 * cm,
                     "* FastAPI reads the Cf-Access-Jwt-Assertion header (already verified by Cloudflare)")


# ── prose helpers ─────────────────────────────────────────────────────────────
def pros_cons_table(styles, pros, cons):
    pro_items = "".join(f"&#x2714;  {p}<br/>" for p in pros)
    con_items = "".join(f"&#x2717;  {c}<br/>" for c in cons)
    pro_para = Paragraph(f"<b>Pros</b><br/>{pro_items}", styles["pc"])
    con_para = Paragraph(f"<b>Cons</b><br/>{con_items}", styles["pc"])
    t = Table([[pro_para, con_para]], colWidths=[8 * cm, 8 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), C_PRO_BG),
        ("BACKGROUND", (1, 0), (1, 0), C_CON_BG),
        ("BOX",        (0, 0), (-1, -1), 0.5, C_BORDER),
        ("INNERGRID",  (0, 0), (-1, -1), 0.5, C_BORDER),
        ("VALIGN",     (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING",   (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
    ]))
    return t


# ── build PDF ─────────────────────────────────────────────────────────────────
def build(out_path):
    doc = SimpleDocTemplate(
        out_path,
        pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
    )

    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle(
            "Title2", parent=base["Title"],
            fontSize=28, textColor=C_HEAD_BG,
            spaceAfter=6, leading=34,
        ),
        "sub": ParagraphStyle(
            "Sub", parent=base["Normal"],
            fontSize=12, textColor=colors.HexColor("#444444"),
            spaceAfter=4,
        ),
        "h1": ParagraphStyle(
            "H1", parent=base["Heading1"],
            fontSize=16, textColor=C_HEAD_BG,
            spaceBefore=6, spaceAfter=4,
        ),
        "h2": ParagraphStyle(
            "H2", parent=base["Heading2"],
            fontSize=12, textColor=colors.HexColor("#333333"),
            spaceBefore=4, spaceAfter=2,
        ),
        "body": ParagraphStyle(
            "Body2", parent=base["Normal"],
            fontSize=10, leading=14,
        ),
        "pc": ParagraphStyle(
            "PC", parent=base["Normal"],
            fontSize=9, leading=14,
        ),
        "tag": ParagraphStyle(
            "Tag", parent=base["Normal"],
            fontSize=9, textColor=colors.white,
            backColor=C_ACCENT_B, borderPadding=3,
        ),
    }

    story = []

    # ── Title page ─────────────────────────────────────────────────────────────
    story.append(Spacer(1, 3 * cm))
    story.append(Paragraph("MindAnchor", styles["title"]))
    story.append(Paragraph("Authentication Options", ParagraphStyle(
        "TitleSub", parent=base["Normal"],
        fontSize=20, textColor=C_ACCENT_B, spaceAfter=12,
    )))
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(
        "This document compares three authentication strategies for a "
        "single-user FastAPI + React PWA. Each option includes a flow "
        "diagram and a pros / cons summary.",
        styles["body"],
    ))
    story.append(Spacer(1, 1 * cm))

    # Summary table
    summary = [
        [Paragraph("<b>Option</b>", styles["body"]),
         Paragraph("<b>Approach</b>", styles["body"]),
         Paragraph("<b>Complexity</b>", styles["body"]),
         Paragraph("<b>Recommended?</b>", styles["body"])],
        ["A", "Static Bearer Token", "Minimal", "Simple setups only"],
        ["B", "Password + JWT", "Low–Medium", "✔ YES — recommended"],
        ["C", "Cloudflare Access", "Medium", "Great if on CF stack"],
    ]
    t = Table(summary, colWidths=[1.5 * cm, 6 * cm, 3.5 * cm, 5 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), C_HEAD_BG),
        ("TEXTCOLOR",    (0, 0), (-1, 0), colors.white),
        ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.HexColor("#F5F9FF"), colors.white]),
        ("BACKGROUND",   (0, 2), (-1, 2), colors.HexColor("#E8F8F0")),
        ("BOX",          (0, 0), (-1, -1), 0.5, C_BORDER),
        ("INNERGRID",    (0, 0), (-1, -1), 0.5, C_BORDER),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("ALIGN",        (0, 0), (-1, -1), "LEFT"),
    ]))
    story.append(t)
    story.append(PageBreak())

    # ── Option A ───────────────────────────────────────────────────────────────
    story.append(Paragraph("Option A — Static Bearer Token", styles["h1"]))
    story.append(Paragraph(
        "The client sends a long, secret random string in every request header. "
        "The server does a constant-time string comparison against an env var. "
        "No database, no cryptography library, no sessions.",
        styles["body"],
    ))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("Flow diagram", styles["h2"]))
    story.append(DiagramA())
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("Pros &amp; Cons", styles["h2"]))
    story.append(pros_cons_table(styles,
        pros=[
            "Zero setup — no user table, no crypto library",
            "Token is just a long random string (e.g. openssl rand -hex 32)",
            "Easy to understand and audit",
        ],
        cons=[
            "No expiry — token is valid forever until manually rotated",
            "Rotation requires updating the env var and redeploying",
            "No session concept — can't log out without changing the token",
        ],
    ))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(
        "<b>Implementation sketch:</b>  Set <font face=\"Courier\">STATIC_TOKEN</font> in your env. "
        "Add a FastAPI dependency that reads <font face=\"Courier\">Authorization: Bearer &lt;token&gt;</font> "
        "and calls <font face=\"Courier\">secrets.compare_digest()</font>. Return 401 on mismatch.",
        styles["body"],
    ))
    story.append(PageBreak())

    # ── Option B ───────────────────────────────────────────────────────────────
    story.append(Paragraph("Option B — Password Login + JWT", styles["h1"]))
    story.append(Paragraph(
        "<b>RECOMMENDED for MindAnchor.</b>  The user logs in once with a password "
        "(stored only as a bcrypt hash in an env var — no DB row needed). "
        "The server issues a short-lived JWT. Every subsequent request carries "
        "that JWT; the server verifies the signature and expiry without any DB look-up.",
        styles["body"],
    ))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("Flow diagram", styles["h2"]))
    story.append(DiagramB())
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("Pros &amp; Cons", styles["h2"]))
    story.append(pros_cons_table(styles,
        pros=[
            "Industry standard (OAuth2 Bearer / RFC 7519)",
            "Expiry built in — 7-day tokens, then re-login",
            "Rotating JWT_SECRET instantly invalidates all sessions",
            "No user table — password hash stored only in env var",
        ],
        cons=[
            "Slightly more code than Option A (~50 lines with python-jose + passlib)",
            "Token stored in localStorage — readable by JS (mitigated by HTTPS + no 3rd-party scripts)",
            "Stateless — can't revoke a single token before expiry without a denylist",
        ],
    ))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(
        "<b>Required env vars:</b>  "
        "<font face=\"Courier\">PASSWORD_HASH</font> (bcrypt, generate with "
        "<font face=\"Courier\">passlib.hash.bcrypt.hash('yourpassword')</font>), "
        "<font face=\"Courier\">JWT_SECRET</font> (random 32-byte hex), "
        "<font face=\"Courier\">JWT_EXPIRE_DAYS</font> (default 7).  "
        "<b>Required packages:</b>  "
        "<font face=\"Courier\">python-jose[cryptography]</font>, "
        "<font face=\"Courier\">passlib[bcrypt]</font>.",
        styles["body"],
    ))
    story.append(PageBreak())

    # ── Option C ───────────────────────────────────────────────────────────────
    story.append(Paragraph("Option C — External Proxy Auth (Cloudflare Access)", styles["h1"]))
    story.append(Paragraph(
        "Authentication is delegated entirely to Cloudflare Access. "
        "The browser must pass Cloudflare's identity check (email OTP, Google, GitHub, etc.) "
        "before any traffic reaches your backend. Cloudflare injects a signed JWT header "
        "(<font face=\"Courier\">Cf-Access-Jwt-Assertion</font>) which FastAPI can optionally verify.",
        styles["body"],
    ))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("Flow diagram", styles["h2"]))
    story.append(DiagramC())
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("Pros &amp; Cons", styles["h2"]))
    story.append(pros_cons_table(styles,
        pros=[
            "Zero auth code in your app — CF handles 100% of it",
            "MFA / phishing-resistant login (passkeys, hardware keys) for free",
            "Blocks at network edge — malicious traffic never hits your server",
            "Audit log, IP rules, and device posture checks in one place",
        ],
        cons=[
            "Ties your stack to Cloudflare — vendor lock-in",
            "Doesn't work cleanly with Vercel PWA's /api rewrite proxy (both CF and Vercel handle routing)",
            "More infrastructure to configure and maintain",
            "Overkill for a private single-user app not exposed to the internet",
        ],
    ))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(
        "<b>When to choose this:</b>  If your PWA is served via Cloudflare (not Vercel) "
        "and you want zero-effort MFA without writing a single line of auth code. "
        "For MindAnchor's current Vercel + Cloud Run setup, Option B is simpler.",
        styles["body"],
    ))

    doc.build(story)
    print(f"PDF written to {out_path}")


if __name__ == "__main__":
    build("/home/user/MindAnchor/docs/auth-options.pdf")
