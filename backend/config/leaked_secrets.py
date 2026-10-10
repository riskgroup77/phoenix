"""
Ochiq git tarixida (github.com/riskgroup77/phoenix) qolib ketgan maxfiy qiymatlarning SHA-256 izlari.

Qiymatlarning o'zi bu yerda YO'Q — faqat izlar: `launch_check` serverdagi joriy kalit shulardan biri bilan
bir xil bo'lsa, «hali almashtirilmagan» deb ogohlantiradi. Tarixdan o'chirish yetarli emas — kalitni
provayder panelida (Click, Google AI Studio, @BotFather, Postgres) yangilash shart.
"""
import hashlib

LEAKED_SHA256 = {
    'CLICK_SECRET_KEY': frozenset({
        '03cfe57f0187ee80e764ab2d9346f84a39bdec52516d85c8cacabe2aa18d5b4f',
        '78737b53f3d9543d36002594d1bb914400ea23b31167120f04427f20d2497fd8',
    }),
    'GEMINI_API_KEY': frozenset({
        '70c3af180bfb44699d82f25c3e0c6d320d143bfaec49cad43e563e7245b0f1b8',
        'd6669cbbcffd90938a7f7254cf2c991df80da031c3228cbf3658756befbeebc3',
    }),
    'DB_PASSWORD': frozenset({
        '62b210ee562efc92f89b4c98c5cc7422e8f7763d47a148c6c69ff40ac7e94186',
        'a942b37ccfaf5a813b1432caa209a43b9d144e47ad0de1549c289c253e556cd5',
        'f3a6387dd94b5a435796fa65923f46560bc711f8273a08a8d8f7310b93fed617',
        'ce849d95a5aef98f42a8a33b7a6654ab69716a567daf516ee7e5d47e686af9fd',
    }),
    'SECRET_KEY': frozenset({
        '316b4634c576f1c668aebde374e24721bec73c71f191e8e24b48a364a148d92b',
        '82acf130c5df081492a56eda7f865b9f9cf3601e71bedb07fb964a57abd56c2c',
        'c91d2e64e1ed348c5ee2db36ab922ba27b31f8299ddfc4d0b406bb770b44e597',
        'e58d8d950124f1d6d2936c4daffe78d868119dad3984c7a3f5aafeb1f4de3242',
    }),
    'TELEGRAM_BOT_TOKEN': frozenset({
        '6c31f60a02f1536fc74d2bad8cc6575c211fbb472dc7d633ec695fa280ef5782',
        'd741e4cfcc47bfbf0fb384d768b22a9e91fc9e91a350afcce454c0b109cb455a',
    }),
}


def is_leaked(kind: str, value) -> bool:
    if not value:
        return False
    digest = hashlib.sha256(str(value).strip().encode('utf-8')).hexdigest()
    return digest in LEAKED_SHA256.get(kind, frozenset())
