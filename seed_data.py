"""Default board state used when the database is empty."""

import random


PEOPLE = {
    "jn": {"name": "Jean", "initials": "JN", "color": "#27a468", "role": "Finances", "al": ["jean"]},
    "fd": {
        "name": "Florian",
        "initials": "FD",
        "color": "#3b6ef6",
        "role": "Customer outreach, raising money, and recruitment",
        "al": ["florian", "flo", "fluorine", "florine", "florent", "floriane"],
    },
    "ia": {
        "name": "Iannis",
        "initials": "IA",
        "color": "#e8930c",
        "role": "Building the robot and operating system",
        "al": ["iannis", "yannis", "yanis", "ianis", "ioannis", "janice", "janis", "yanni", "ennis"],
    },
    "ak": {
        "name": "Akshat",
        "initials": "AK",
        "color": "#9b59d0",
        "role": "Obstacle avoidance and autonomous locomotion",
        "al": ["akshat", "akshad", "akshot", "axat", "akshut"],
    },
    "sk": {
        "name": "Sanket",
        "initials": "SK",
        "color": "#d4488e",
        "role": "Control and embedded systems",
        "al": ["sanket", "sankeet", "sankit", "sunket", "sanke"],
    },
    "lm": {
        "name": "Liam",
        "initials": "LM",
        "color": "#0ea5b7",
        "role": "General / operations",
        "al": ["liam", "leam"],
    },
    "ly": {
        "name": "Leynaïck",
        "initials": "LY",
        "color": "#647acb",
        "role": "Electronics (intern)",
        "al": ["leynaïck", "leynaick", "lenaick", "laynaick", "leinaick", "lenix", "laynick"],
    },
}

CLIENTS = [
    {"name": "Onet", "al": ["onet", "o net", "onnet", "aunet"]},
    {"name": "Derichebourg", "al": ["derichebourg", "de riche bourg", "derichbourg", "derich bourg", "deurichebourg"]},
    {"name": "NSI", "al": ["nsi", "n s i", "ensi", "n.s.i"]},
    {"name": "Areas", "al": ["areas", "aréas", "arias", "ariane", "arrears"]},
    {"name": "JCDecaux", "al": ["jcdecaux", "jc decaux", "jcd", "jic decaux", "jaycee decaux", "jay c decaux"]},
]

HARDWARE_VOCAB = [
    "Robstride motors: RS00, RS02, RS03, RS04, EL05",
    "Feetech motors (all models)",
    "Hub motors (used for the wheels - primary locomotion)",
    "D-Wave board (custom hardware board in the current robots)",
]

DOMAIN_RULES = [
    {"o": "ak", "kw": ["obstacle", "avoidance", "autonom", "navigation", "locomot", "path planning", "slam", "perception", "mapping"]},
    {"o": "sk", "kw": ["control", "embedded", "firmware", "motor control", "pid", "actuator", "can bus", "servo", "rs0", "rs00", "rs02", "rs03", "rs04", "el05", "feetech", "hub motor", "motor"]},
    {"o": "ia", "kw": ["operating system", " os ", "assembly", "chassis", "mechanical", "integration", "build the robot", "robot build", "frame"]},
    {"o": "ly", "kw": ["electronic", "d-wave", "dwave", "board", "power", "wiring", "pcb", "circuit", "battery", "soldering", "harness"]},
    {"o": "jn", "kw": ["budget", "invoice", "finance", "cost", "payment", "accounting", "payroll"]},
    {"o": "fd", "kw": ["client", "outreach", "fundrais", "recruit", "hiring", "pilot", "sales", "demo", "investor", "contract"]},
]


def _t(uid, title, owner, **opts):
    node = {
        "id": uid,
        "title": title,
        "owner": owner,
        "priority": opts.get("p", "med"),
        "due": opts.get("d"),
        "start": opts.get("st"),
        "size": opts.get("s"),
        "done": opts.get("done", False),
        "doneAt": None,
        "children": opts.get("c", []),
        "open": opts.get("open", False),
    }
    if opts.get("done"):
        node["doneAt"] = opts.get("done_at", "2026-06-12")
    return node


def _build_tasks():
    uid = 0

    def t(title, owner, **opts):
        nonlocal uid
        uid += 1
        children = opts.pop("c", [])
        node = _t(uid, title, owner, **opts)
        node["children"] = [t(**child) if isinstance(child, dict) and "title" in child else child for child in children]
        if children and all(isinstance(c, dict) for c in children):
            built = []
            for child in children:
                uid += 1
                sub_children = child.pop("c", [])
                sub = _t(uid, child["title"], child["owner"], **{k: v for k, v in child.items() if k not in ("title", "owner")})
                sub["children"] = []
                for gc in sub_children:
                    uid += 1
                    sub["children"].append(_t(uid, gc["title"], gc["owner"], **{k: v for k, v in gc.items() if k not in ("title", "owner")}))
                built.append(sub)
            node["children"] = built
        return node

    # Build manually to match the original nested structure exactly
    def make(title, owner, **opts):
        nonlocal uid
        uid += 1
        kids = opts.pop("c", [])
        node = _t(uid, title, owner, **opts)
        node["children"] = kids
        return node

    tasks = [
        make(
            "Derichebourg pilot - sorting robot",
            "ia",
            p="high",
            d="2026-07-10",
            open=True,
            c=[
                make(
                    "Integrate RS03 drive motors",
                    "sk",
                    p="high",
                    d="2026-06-16",
                    s="l",
                    open=True,
                    c=[
                        make("Mount RS03 motors and couplers", "sk", done=True, d="2026-06-08", s="m"),
                        make("Wire motor CAN bus to controller", "sk", d="2026-06-14", s="m"),
                        make("Calibrate RS03 torque limits", "sk", d="2026-06-17", s="s"),
                    ],
                ),
                make(
                    "Tune obstacle avoidance for the sorting line",
                    "ak",
                    p="high",
                    d="2026-06-19",
                    s="l",
                    open=True,
                    c=[
                        make("Collect depth data along the conveyor", "ak", done=True, d="2026-06-10", s="m"),
                        make("Train avoidance model", "ak", d="2026-06-18", s="l"),
                        make("Field test near the conveyor", "ak", d="2026-06-22", s="m"),
                    ],
                ),
                make(
                    "Fix D-Wave board brownout under load",
                    "ly",
                    p="high",
                    d="2026-06-12",
                    s="m",
                    open=True,
                    c=[
                        make("Diagnose the power regulator", "ly", done=True, d="2026-06-11", s="s"),
                        make("Replace regulator and retest", "ly", d="2026-06-13", s="m"),
                    ],
                ),
                make("Approve motor procurement budget", "jn", d="2026-06-15", s="s"),
                make("Coordinate on-site pilot install", "fd", d="2026-06-30", s="l"),
            ],
        ),
        make(
            "JCDecaux pilot - billboard servicing",
            "ak",
            p="high",
            d="2026-07-20",
            open=True,
            c=[
                make(
                    "Design board-mount manipulator arm",
                    "ia",
                    d="2026-06-23",
                    s="l",
                    open=True,
                    c=[
                        make("CAD the arm linkage", "ia", d="2026-06-18", s="m"),
                        make("Source Feetech servos for the arm", "lm", d="2026-06-20", s="s"),
                    ],
                ),
                make(
                    "Autonomous navigation between billboards",
                    "ak",
                    p="high",
                    d="2026-06-26",
                    s="xl",
                    open=True,
                    c=[
                        make("Build city route planner", "ak", d="2026-06-24", s="l"),
                        make("GPS waypoint following", "ak", d="2026-06-25", s="m"),
                    ],
                ),
                make("Hub-motor sizing for outdoor terrain", "sk", d="2026-06-20", s="m"),
                make("Demo prep for JCDecaux", "fd", d="2026-06-27", s="s"),
            ],
        ),
        make(
            "Onet pilot - floor-cleaning autonomy",
            "ak",
            d="2026-08-01",
            open=True,
            c=[
                make("Map the Onet facility floorplan", "ak", d="2026-06-21", s="m"),
                make(
                    "Integrate Feetech servos for the brush arm",
                    "sk",
                    d="2026-06-24",
                    s="m",
                    open=True,
                    c=[
                        make("Mount the brush assembly", "lm", d="2026-06-22", s="s"),
                        make("Tune servo sweep pattern", "sk", d="2026-06-25", s="s"),
                    ],
                ),
                make("Safety e-stop wiring", "ly", p="high", d="2026-06-16", s="s"),
            ],
        ),
        make(
            "RoboOS v2 - core platform",
            "ia",
            p="high",
            d="2026-07-31",
            open=True,
            c=[
                make(
                    "Migrate OS to RS04 motor drivers",
                    "sk",
                    p="high",
                    d="2026-06-24",
                    s="l",
                    open=True,
                    c=[
                        make("Port CAN driver to RS04", "sk", d="2026-06-22", s="m"),
                        make("Bench-test RS04 closed loop", "sk", d="2026-06-23", s="m"),
                    ],
                ),
                make("Real-time locomotion controller", "ak", d="2026-06-29", s="l"),
                make(
                    "Evaluate EL05 actuators",
                    "sk",
                    d="2026-06-17",
                    s="m",
                    open=True,
                    c=[
                        make("Run EL05 load tests", "sk", done=True, d="2026-06-09", s="s"),
                        make("Compare EL05 vs RS02 efficiency", "sk", d="2026-06-18", s="s"),
                    ],
                ),
                make("Nightly build + hardware-in-the-loop rig", "ia", d="2026-06-21", s="m"),
                make("Assemble robot chassis v2", "ia", d="2026-07-06", s="l"),
            ],
        ),
        make(
            "NSI pilot - inventory scanning",
            "ia",
            d="2026-07-15",
            open=True,
            c=[
                make("Scoping follow-up with NSI", "fd", d="2026-06-19", s="s"),
                make("Barcode scanner integration", "sk", d="2026-06-28", s="m"),
                make("Aisle navigation tuning", "ak", d="2026-07-02", s="m"),
            ],
        ),
    ]

    def walk(nodes, parent=None, depth=0):
        rng = random.Random(7)
        keys = list(PEOPLE.keys())
        for n in nodes:
            if depth >= 2 and parent:
                n["owner"] = parent["owner"] if rng.random() < 0.7 else keys[int(rng.random() * len(keys))]
            walk(n["children"], n, depth + 1)

    walk(tasks)
    return tasks, uid


def default_board():
    tasks, uid = _build_tasks()
    return {
        "people": PEOPLE,
        "tasks": tasks,
        "clients": CLIENTS,
        "hardware_vocab": HARDWARE_VOCAB,
        "domain_rules": DOMAIN_RULES,
        "uid": uid,
        "today": "2026-06-12",
    }
