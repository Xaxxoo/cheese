from __future__ import annotations

import math
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUTPUT_DIR = Path(__file__).resolve().parent
SLIDE_DIR = OUTPUT_DIR / "slides"
PDF_PATH = OUTPUT_DIR / "AI_for_Youth_Enterprise_Turning_Local_Problems_into_Scalable_Businesses.pdf"
NOTES_PATH = OUTPUT_DIR / "speaker-notes.md"

WIDTH = 1920
HEIGHT = 1080

GREEN = "#047834"
DARK_GREEN = "#035025"
LIGHT_GREEN = "#EAF7EF"
YELLOW = "#F2B705"
RED = "#C92027"
INK = "#111827"
MUTED = "#5B6673"
WHITE = "#FFFFFF"
PALE = "#F8FBF7"
LINE = "#D7E8DC"


def font_path(name: str) -> str:
    candidates = [
        f"/System/Library/Fonts/Supplemental/{name}",
        f"/Library/Fonts/{name}",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    return "/System/Library/Fonts/Supplemental/Arial.ttf"


FONT_REGULAR = font_path("Arial.ttf")
FONT_BOLD = font_path("Arial Bold.ttf")
FONT_BLACK = font_path("Arial Black.ttf")
FONT_ITALIC = font_path("Arial Italic.ttf")


def load_font(size: int, weight: str = "regular") -> ImageFont.FreeTypeFont:
    path = {
        "regular": FONT_REGULAR,
        "bold": FONT_BOLD,
        "black": FONT_BLACK,
        "italic": FONT_ITALIC,
    }.get(weight, FONT_REGULAR)
    return ImageFont.truetype(path, size)


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


def wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""

    for word in words:
        trial = word if not current else f"{current} {word}"
        if text_size(draw, trial, font)[0] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word

    if current:
        lines.append(current)
    return lines


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    font: ImageFont.FreeTypeFont,
    fill: str,
    max_width: int,
    line_gap: int = 12,
    max_lines: int | None = None,
) -> int:
    x_pos, y_pos = xy
    lines = wrap_text(draw, text, font, max_width)
    if max_lines is not None:
        lines = lines[:max_lines]

    line_height = text_size(draw, "Ag", font)[1] + line_gap
    for line in lines:
        draw.text((x_pos, y_pos), line, font=font, fill=fill)
        y_pos += line_height
    return y_pos


def rounded_rect(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    fill: str,
    outline: str | None = None,
    radius: int = 34,
    width: int = 2,
) -> None:
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def draw_footer(draw: ImageDraw.ImageDraw, slide_no: int) -> None:
    footer_font = load_font(24, "bold")
    small_font = load_font(22)
    draw.line((110, HEIGHT - 100, WIDTH - 110, HEIGHT - 100), fill=LINE, width=2)
    draw.text((110, HEIGHT - 74), "AI for Youth Enterprise", font=small_font, fill=MUTED)
    slide_text = f"{slide_no:02d}"
    slide_width = text_size(draw, slide_text, footer_font)[0]
    draw.text((WIDTH - 110 - slide_width, HEIGHT - 76), slide_text, font=footer_font, fill=GREEN)


def draw_brand(draw: ImageDraw.ImageDraw) -> None:
    draw.ellipse((WIDTH - 230, -130, WIDTH + 120, 220), fill=LIGHT_GREEN)
    draw.arc((WIDTH - 330, -230, WIDTH + 220, 320), 90, 180, fill=GREEN, width=10)
    for index in range(7):
        draw.ellipse((70 + index * 34, 82, 82 + index * 34, 94), fill=GREEN)
        draw.ellipse((70 + index * 34, 118, 82 + index * 34, 130), fill=YELLOW)
    draw.rectangle((0, HEIGHT - 32, WIDTH, HEIGHT), fill=GREEN)
    draw.rectangle((0, HEIGHT - 32, 520, HEIGHT), fill=YELLOW)


def base_slide(slide_no: int, title: str | None = None, subtitle: str | None = None) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (WIDTH, HEIGHT), PALE)
    draw = ImageDraw.Draw(image)
    draw_brand(draw)
    if title:
        title_font = load_font(58, "black")
        draw.text((110, 92), title, font=title_font, fill=INK)
    if subtitle:
        draw_wrapped(draw, subtitle, (112, 172), load_font(30), MUTED, WIDTH - 240, line_gap=8)
    draw_footer(draw, slide_no)
    return image, draw


def draw_big_number(draw: ImageDraw.ImageDraw, number: str, label: str, x_pos: int, y_pos: int, color: str) -> None:
    rounded_rect(draw, (x_pos, y_pos, x_pos + 330, y_pos + 210), WHITE, LINE, radius=28)
    draw.text((x_pos + 34, y_pos + 38), number, font=load_font(72, "black"), fill=color)
    draw_wrapped(draw, label, (x_pos + 36, y_pos + 126), load_font(25, "bold"), INK, 260, line_gap=8)


def draw_pill(draw: ImageDraw.ImageDraw, text: str, x_pos: int, y_pos: int, fill: str = GREEN) -> None:
    font = load_font(26, "bold")
    text_width, text_height = text_size(draw, text, font)
    rounded_rect(draw, (x_pos, y_pos, x_pos + text_width + 44, y_pos + text_height + 24), fill, None, radius=28)
    draw.text((x_pos + 22, y_pos + 10), text, font=font, fill=WHITE)


def slide_title(slide_no: int) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), PALE)
    draw = ImageDraw.Draw(image)
    draw_brand(draw)

    draw_pill(draw, "Youth Entrepreneurship Summit 2026 / Market Planet", 110, 105)
    draw.text((110, 210), "AI FOR", font=load_font(96, "black"), fill=GREEN)
    draw.text((110, 320), "YOUTH", font=load_font(96, "black"), fill=INK)
    draw.text((110, 430), "ENTERPRISE", font=load_font(96, "black"), fill=INK)
    draw_wrapped(
        draw,
        "Turning Local Problems into Scalable Businesses",
        (116, 570),
        load_font(48, "bold"),
        RED,
        1000,
        line_gap=16,
    )
    draw_wrapped(
        draw,
        "Ideas ignite change. Innovation creates opportunities. Leadership transforms nations.",
        (116, 735),
        load_font(31, "italic"),
        DARK_GREEN,
        960,
        line_gap=12,
    )

    rounded_rect(draw, (1210, 240, 1748, 742), GREEN, None, radius=52)
    draw.text((1280, 315), "LEARN", font=load_font(58, "black"), fill=WHITE)
    draw.text((1280, 410), "CONNECT", font=load_font(58, "black"), fill=WHITE)
    draw.text((1280, 505), "BUILD", font=load_font(58, "black"), fill=YELLOW)
    draw.line((1280, 608, 1665, 608), fill=YELLOW, width=8)
    draw_wrapped(draw, "A practical AI playbook for young entrepreneurs.", (1282, 640), load_font(28), WHITE, 370)

    draw_footer(draw, slide_no)
    return image


def slide_agenda(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no, "What We’ll Cover", "A practical route from curiosity to enterprise.")
    items = [
        ("1", "What AI really is", "A tool for thinking, creating, and automating — not magic."),
        ("2", "Finding local problems", "How to turn daily frustrations into business opportunities."),
        ("3", "Building with little capital", "Use AI to research, prototype, market, and serve customers."),
        ("4", "Scaling responsibly", "Build trust, protect data, and lead with discipline."),
    ]
    for index, (number, heading, body) in enumerate(items):
        top = 265 + index * 155
        draw.ellipse((118, top, 188, top + 70), fill=GREEN)
        draw.text((141, top + 16), number, font=load_font(32, "black"), fill=WHITE)
        draw.text((220, top), heading, font=load_font(38, "bold"), fill=INK)
        draw_wrapped(draw, body, (222, top + 52), load_font(28), MUTED, 1300, line_gap=8)
    return image


def slide_ai_is(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no, "AI Is a Business Multiplier", "Think of AI as a low-cost assistant that increases what one person can do.")
    columns = [
        ("Research", "Understand customers, competitors, markets, and trends faster."),
        ("Creation", "Draft content, designs, proposals, scripts, and product copy."),
        ("Automation", "Handle repeated tasks like replies, summaries, tracking, and reports."),
        ("Decision support", "Compare options, spot patterns, and improve planning."),
    ]
    for index, (heading, body) in enumerate(columns):
        x_pos = 110 + (index % 2) * 860
        y_pos = 295 + (index // 2) * 270
        rounded_rect(draw, (x_pos, y_pos, x_pos + 760, y_pos + 210), WHITE, LINE, radius=30)
        draw.text((x_pos + 36, y_pos + 34), heading, font=load_font(38, "black"), fill=GREEN)
        draw_wrapped(draw, body, (x_pos + 38, y_pos + 92), load_font(29), INK, 650, line_gap=10)
    draw.text((112, 855), "Important: AI does not replace judgment. It rewards people who ask better questions.", font=load_font(32, "bold"), fill=RED)
    return image


def slide_why_now(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no, "Why This Matters Now", "Young entrepreneurs can now access tools that used to require big teams and big budgets.")
    draw_big_number(draw, "1", "Ideas can be tested faster", 120, 315, GREEN)
    draw_big_number(draw, "2", "Small teams can look professional", 515, 315, GREEN)
    draw_big_number(draw, "3", "Local knowledge becomes an advantage", 910, 315, GREEN)
    draw_big_number(draw, "4", "Markets can be reached digitally", 1305, 315, GREEN)
    rounded_rect(draw, (190, 625, 1730, 790), DARK_GREEN, None, radius=36)
    draw_wrapped(
        draw,
        "The opportunity is not just to use AI. The opportunity is to combine AI with local insight, trust, and execution.",
        (245, 672),
        load_font(38, "bold"),
        WHITE,
        1420,
        line_gap=12,
    )
    return image


def slide_local_problems(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no, "Local Problems Are Startup Opportunities", "Every strong business begins with a pain point someone wants solved.")
    sections = [
        ("Observe", "What wastes time, money, energy, or dignity around you?"),
        ("Validate", "Who feels the pain often enough to pay or support a solution?"),
        ("Simplify", "What is the smallest useful version you can build this month?"),
        ("Distribute", "Where do customers already spend attention: WhatsApp, campus, markets, churches, mosques, farms?"),
    ]
    for index, (heading, body) in enumerate(sections):
        x_pos = 135 + index * 430
        rounded_rect(draw, (x_pos, 300, x_pos + 360, 650), WHITE, LINE, radius=32)
        draw.text((x_pos + 32, 340), heading, font=load_font(36, "black"), fill=GREEN)
        draw.line((x_pos + 32, 400, x_pos + 170, 400), fill=YELLOW, width=8)
        draw_wrapped(draw, body, (x_pos + 32, 450), load_font(28), INK, 290, line_gap=10)
    draw_wrapped(
        draw,
        "If the problem is close to you, your solution can be more trusted than a foreign product.",
        (190, 775),
        load_font(38, "bold"),
        DARK_GREEN,
        1500,
    )
    return image


def slide_canvas(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no, "The Problem-to-Product Canvas", "Use this before you build anything.")
    prompts = [
        ("Problem", "What exact pain are you solving?"),
        ("Customer", "Who has this problem most often?"),
        ("Current workaround", "How do they solve it today?"),
        ("AI advantage", "What can AI make faster, cheaper, or better?"),
        ("First offer", "What will you sell or deliver first?"),
    ]
    y_pos = 260
    for heading, body in prompts:
        rounded_rect(draw, (150, y_pos, 1770, y_pos + 105), WHITE, LINE, radius=24)
        draw.text((185, y_pos + 26), heading, font=load_font(32, "black"), fill=GREEN)
        draw_wrapped(draw, body, (520, y_pos + 28), load_font(31), INK, 1120, line_gap=8)
        y_pos += 122
    return image


def slide_usecase_map(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no, "Where AI Fits in a Youth Enterprise", "Use AI across the full business cycle, not only for content.")
    stages = [
        ("Discover", "Surveys, interviews, market research"),
        ("Design", "Brand name, logo ideas, product copy"),
        ("Build", "No-code apps, websites, chatbots"),
        ("Sell", "Ads, WhatsApp scripts, pitch decks"),
        ("Operate", "Customer support, records, reports"),
        ("Scale", "Dashboards, SOPs, team training"),
    ]
    center_x, center_y = WIDTH // 2, 555
    radius = 310
    for index, (stage, body) in enumerate(stages):
        angle = -math.pi / 2 + index * (2 * math.pi / len(stages))
        x_pos = int(center_x + math.cos(angle) * radius)
        y_pos = int(center_y + math.sin(angle) * radius)
        rounded_rect(draw, (x_pos - 170, y_pos - 70, x_pos + 170, y_pos + 90), WHITE, LINE, radius=28)
        draw.text((x_pos - 125, y_pos - 42), stage, font=load_font(30, "black"), fill=GREEN)
        draw_wrapped(draw, body, (x_pos - 125, y_pos + 5), load_font(22), MUTED, 250, line_gap=6)
        draw.line((center_x, center_y, x_pos, y_pos), fill=LINE, width=4)
    draw.ellipse((center_x - 145, center_y - 145, center_x + 145, center_y + 145), fill=GREEN)
    draw.text((center_x - 82, center_y - 50), "AI", font=load_font(76, "black"), fill=WHITE)
    draw.text((center_x - 103, center_y + 34), "ASSISTED", font=load_font(24, "bold"), fill=YELLOW)
    return image


def slide_example_food(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no, "Example 1: Campus Food Pre-order", "A simple local problem can become a scalable service.")
    rows = [
        ("Problem", "Students waste time waiting for food or miss meals between lectures."),
        ("AI use", "WhatsApp ordering assistant, menu suggestions, demand forecast, vendor summaries."),
        ("Business model", "Small commission per order, vendor subscription, delivery fee."),
        ("Scale path", "One hostel -> one faculty -> full campus -> other schools."),
    ]
    y_pos = 290
    for heading, body in rows:
        draw.text((145, y_pos), heading, font=load_font(34, "black"), fill=GREEN)
        draw_wrapped(draw, body, (430, y_pos), load_font(31), INK, 1220, line_gap=10)
        y_pos += 125
    rounded_rect(draw, (1320, 250, 1710, 455), LIGHT_GREEN, GREEN, radius=30, width=4)
    draw.text((1375, 300), "MVP", font=load_font(62, "black"), fill=GREEN)
    draw_wrapped(draw, "Google Form + WhatsApp + daily AI summary", (1360, 380), load_font(27, "bold"), INK, 310)
    return image


def slide_example_agro(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no, "Example 2: Agro Advisory & Market Linkage", "AI becomes powerful when paired with local language, field knowledge, and trusted networks.")
    blocks = [
        ("For farmers", "Crop tips, price checks, weather summaries, pest identification guidance."),
        ("For buyers", "Produce availability, quality records, delivery coordination."),
        ("For youth entrepreneurs", "Act as the bridge: collect data, verify supply, coordinate transactions."),
    ]
    for index, (heading, body) in enumerate(blocks):
        x_pos = 140 + index * 575
        rounded_rect(draw, (x_pos, 305, x_pos + 500, 650), WHITE, LINE, radius=32)
        draw.text((x_pos + 34, 350), heading, font=load_font(34, "black"), fill=GREEN)
        draw_wrapped(draw, body, (x_pos + 36, 420), load_font(29), INK, 420, line_gap=10)
    draw_wrapped(draw, "Key lesson: AI can process information, but trust is built by people on the ground.", (190, 780), load_font(38, "bold"), DARK_GREEN, 1500)
    return image


def slide_example_learning(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no, "Example 3: Learning & Skills Business", "Education is one of the easiest places to start with AI-assisted enterprise.")
    left = [
        "Exam practice bots for specific courses",
        "Study summaries from lecture notes",
        "CV, LinkedIn, and scholarship support",
        "Skill tutorials for design, coding, data, and business",
    ]
    draw.text((150, 285), "Opportunities", font=load_font(42, "black"), fill=GREEN)
    y_pos = 360
    for item in left:
        draw.ellipse((160, y_pos + 10, 180, y_pos + 30), fill=YELLOW)
        draw_wrapped(draw, item, (210, y_pos), load_font(32), INK, 710)
        y_pos += 90
    rounded_rect(draw, (1050, 285, 1700, 740), DARK_GREEN, None, radius=42)
    draw.text((1115, 345), "Starter offer", font=load_font(44, "black"), fill=YELLOW)
    draw_wrapped(draw, "A weekly AI-assisted study pack for one difficult course, sold to students at a low subscription price.", (1118, 430), load_font(34, "bold"), WHITE, 520, line_gap=14)
    return image


def slide_tools(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no, "A Practical AI Toolkit", "You do not need a large budget to begin.")
    tools = [
        ("Thinking", "ChatGPT or similar tools for research, planning, and writing."),
        ("Design", "Canva AI or design assistants for flyers, product mockups, and pitch decks."),
        ("Data", "Google Forms/Sheets for customer feedback and simple records."),
        ("Sales", "WhatsApp Business for catalogues, customer replies, and follow-up."),
        ("Building", "No-code tools, websites, and simple automations."),
        ("Learning", "YouTube, online courses, and AI tutors for skill development."),
    ]
    for index, (heading, body) in enumerate(tools):
        x_pos = 125 + (index % 3) * 575
        y_pos = 280 + (index // 3) * 260
        rounded_rect(draw, (x_pos, y_pos, x_pos + 500, y_pos + 195), WHITE, LINE, radius=28)
        draw.text((x_pos + 30, y_pos + 32), heading, font=load_font(34, "black"), fill=GREEN)
        draw_wrapped(draw, body, (x_pos + 32, y_pos + 88), load_font(26), INK, 415, line_gap=8)
    return image


def slide_prompting(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no, "The Skill: Asking Better Questions", "The quality of AI output depends on the quality of your instructions.")
    prompt = (
        "Act as a business mentor. I am a student in Dutse. Help me identify 10 business "
        "problems around campus, rank them by urgency, startup cost, and ability to earn "
        "within 30 days. Ask me questions before finalizing."
    )
    rounded_rect(draw, (150, 285, 1770, 545), WHITE, GREEN, radius=34, width=4)
    draw_wrapped(draw, prompt, (205, 340), load_font(36, "bold"), INK, 1500, line_gap=14)
    tips = [
        "Give context",
        "Define the role",
        "Ask for options",
        "Request examples",
        "Verify facts",
    ]
    for index, tip in enumerate(tips):
        draw_pill(draw, tip, 160 + index * 330, 675, DARK_GREEN if index % 2 else GREEN)
    return image


def slide_responsible(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no, "Responsible AI Builds Trust", "Speed without integrity destroys a business.")
    principles = [
        ("Privacy", "Do not upload customers’ private data carelessly."),
        ("Truth", "Verify facts, prices, medical/legal claims, and statistics."),
        ("Originality", "Use AI to assist your thinking, not to fake expertise."),
        ("Fairness", "Check if your solution excludes people because of language, disability, gender, or income."),
        ("Human judgment", "Keep final decisions with accountable people."),
    ]
    y_pos = 270
    for heading, body in principles:
        draw.text((150, y_pos), heading, font=load_font(32, "black"), fill=GREEN)
        draw_wrapped(draw, body, (460, y_pos), load_font(30), INK, 1150, line_gap=8)
        y_pos += 115
    return image


def slide_30_day(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no, "A 30-Day AI Enterprise Challenge", "Leave the summit with a plan you can execute immediately.")
    phases = [
        ("Days 1-7", "Discover", "Interview 20 people. Find one painful repeated problem."),
        ("Days 8-14", "Prototype", "Use AI to design the smallest useful offer."),
        ("Days 15-21", "Sell", "Get 5 paying or committed users before building more."),
        ("Days 22-30", "Systemize", "Document the process, automate one task, recruit one helper."),
    ]
    for index, (period, heading, body) in enumerate(phases):
        x_pos = 120 + index * 445
        rounded_rect(draw, (x_pos, 310, x_pos + 390, 705), WHITE, LINE, radius=34)
        draw.text((x_pos + 32, 360), period, font=load_font(30, "black"), fill=YELLOW)
        draw.text((x_pos + 32, 425), heading, font=load_font(42, "black"), fill=GREEN)
        draw_wrapped(draw, body, (x_pos + 34, 505), load_font(29), INK, 315, line_gap=10)
    draw_wrapped(draw, "Do not wait for perfect conditions. Build a small proof, then improve.", (220, 820), load_font(38, "bold"), RED, 1450)
    return image


def slide_leadership(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no, "Leadership in the AI Age", "National development needs builders, not spectators.")
    statements = [
        "Lead by solving problems close to you.",
        "Lead by building teams with complementary skills.",
        "Lead by using technology ethically.",
        "Lead by creating jobs, not only looking for jobs.",
    ]
    y_pos = 310
    for index, statement in enumerate(statements):
        draw.ellipse((150, y_pos, 210, y_pos + 60), fill=GREEN if index != 3 else RED)
        draw.text((169, y_pos + 13), str(index + 1), font=load_font(28, "black"), fill=WHITE)
        draw_wrapped(draw, statement, (250, y_pos + 8), load_font(40, "bold"), INK, 1300)
        y_pos += 120
    return image


def slide_close(slide_no: int) -> Image.Image:
    image, draw = base_slide(slide_no)
    draw.text((140, 165), "Your Assignment", font=load_font(72, "black"), fill=GREEN)
    draw_wrapped(
        draw,
        "Pick one local problem. Talk to one real customer. Use AI to build one useful first version.",
        (145, 280),
        load_font(54, "black"),
        INK,
        1320,
        line_gap=18,
    )
    rounded_rect(draw, (145, 580, 1100, 760), DARK_GREEN, None, radius=36)
    draw_wrapped(draw, "The future will not only belong to people who use AI. It will belong to people who use AI to serve others.", (190, 620), load_font(34, "bold"), WHITE, 850, line_gap=12)
    draw.text((145, 850), "Thank you.", font=load_font(64, "black"), fill=RED)
    draw.text((145, 930), "Questions & discussion", font=load_font(34, "bold"), fill=MUTED)
    return image


SLIDES = [
    slide_title,
    slide_agenda,
    slide_ai_is,
    slide_why_now,
    slide_local_problems,
    slide_canvas,
    slide_usecase_map,
    slide_example_food,
    slide_example_agro,
    slide_example_learning,
    slide_tools,
    slide_prompting,
    slide_responsible,
    slide_30_day,
    slide_leadership,
    slide_close,
]


NOTES = [
    ("Title", "Open by connecting the summit theme to AI: entrepreneurship turns problems into value, innovation changes how value is created, and leadership ensures that value serves society."),
    ("What We’ll Cover", "Set expectations: this is not a technical lecture. It is a practical playbook for students and young entrepreneurs."),
    ("AI Is a Business Multiplier", "Explain AI as an assistant. The key message is leverage: one focused person can now do research, writing, planning, and customer support faster."),
    ("Why This Matters Now", "Emphasize that the cost of testing ideas has dropped. The advantage now belongs to people who execute quickly and understand their local market."),
    ("Local Problems Are Startup Opportunities", "Ask the audience to think about queues, poor information, fragmented markets, transport friction, unreliable vendors, and learning gaps."),
    ("Problem-to-Product Canvas", "Walk through one example live. Encourage them to validate before building."),
    ("Where AI Fits", "Show that AI is useful across the business cycle. It is not just for writing captions."),
    ("Campus Food Pre-order", "Make it concrete. The first version can be simple: a form, WhatsApp group, and daily vendor summaries."),
    ("Agro Advisory", "Connect to wider regional opportunities: agriculture, market access, and trusted local coordination."),
    ("Learning & Skills", "Education is familiar to students. Show how a student can start with one course or one skill niche."),
    ("Toolkit", "Mention that tools are less important than workflow. A disciplined entrepreneur can start with free or low-cost tools."),
    ("Prompting", "Read the sample prompt. Explain that good prompts include context, role, constraints, and desired output."),
    ("Responsible AI", "Warn against fake expertise, plagiarism, privacy mistakes, and misinformation. Trust is an asset."),
    ("30-Day Challenge", "Give them a simple post-event action plan. Tell them to get proof from real users before seeking funding."),
    ("Leadership", "Tie back to national development: businesses create jobs, solve local problems, and build confidence."),
    ("Closing", "End with a clear assignment and invite questions."),
]


def write_notes() -> None:
    lines = [
        "# AI for Youth Enterprise: Turning Local Problems into Scalable Businesses",
        "",
        "Speaker notes for the slide deck.",
        "",
    ]
    for index, (title, note) in enumerate(NOTES, start=1):
        lines.extend([f"## Slide {index}: {title}", "", textwrap.fill(note, width=100), ""])
    NOTES_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    SLIDE_DIR.mkdir(parents=True, exist_ok=True)
    images: list[Image.Image] = []
    for index, slide_factory in enumerate(SLIDES, start=1):
        slide_image = slide_factory(index)
        slide_path = SLIDE_DIR / f"slide-{index:02d}.png"
        slide_image.save(slide_path, "PNG", optimize=True)
        images.append(slide_image.convert("RGB"))

    first, *rest = images
    first.save(PDF_PATH, "PDF", resolution=144.0, save_all=True, append_images=rest)
    write_notes()
    print(PDF_PATH)
    print(NOTES_PATH)


if __name__ == "__main__":
    main()
