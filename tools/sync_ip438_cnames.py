#!/usr/bin/env python3
"""Merge the ip438.com CDN CNAME suffix table into cdn_rules.json.

Source snapshot: tools/ip438_cdnfinder_cnames.json (https://www.ip438.com/tool/cdnfinder/)

The snapshot is stored locally so the merge is reproducible and re-runnable.
Row indexes in ROW_TARGET refer to the "rows" array of that snapshot.

Patterns are stored the way the userscript matcher understands them:
  * "token"        -> matches when token is a full label of the CNAME ("akadns")
  * "a.b"          -> matches when the CNAME ends with ".a.b" or equals it
  * "kunlun*.com"  -> glob, "*" is a wildcard (needs glob support in checkDNS)

Usage:
    python3 tools/sync_ip438_cnames.py           # apply merge
    python3 tools/sync_ip438_cnames.py --dry-run # report only
"""

import json
import re
import sys
from collections import OrderedDict

SNAPSHOT = "tools/ip438_cdnfinder_cnames.json"
RULES = "cdn_rules.json"

# ip438 row index -> provider key in cdn_rules.json
ROW_TARGET = {
    0: "360 Cloud CDN",
    1: "360 Cloud CDN",
    2: "AT&T CDN",
    3: "Amazon Web Services",
    4: "AWS CloudFront",
    5: "Akamai",
    6: "Azion",
    7: "BelugaCDN",
    8: "Bilibili CDN",
    9: "Bilibili CDN",
    10: "Bilibili CDN",
    11: "BunnyCDN",
    12: "CDN.NET / CDNSUN",
    13: "CDN.NET / CDNSUN",
    14: "CDN77",
    15: "CDNIFY",
    16: "CDN.NET / CDNSUN",
    17: "CDNetworks",
    18: "CacheFly",
    19: "Cedexis GSLB",
    20: "Cedexis GSLB",
    21: "CenturyLink CDN (Level 3)",
    22: "CloudXNS",
    23: "Cloudflare",
    24: "Coding Pages",
    25: "SwiftServe CDN",
    26: "Fastly",
    27: "FlexBalancer",
    28: "Gcore",
    29: "GitHub Pages",
    30: "GitLab Pages",
    31: "Google Cloud Storage",
    32: "Google Cloud CDN",
    33: "Heroku",
    34: "Imperva",
    35: "Instart Logic",
    36: "Internap CDN",
    37: "KeyCDN",
    38: "LeaseWeb CDN",
    39: "Edgio",
    40: "Medianova",
    41: "Microsoft Azure App Service",
    42: "Microsoft Azure App Service",
    43: "Microsoft Azure CDN",
    44: "Microsoft Azure CDN",
    45: "Microsoft Azure Traffic Manager",
    46: "Netlify",
    47: "NodeCache",
    48: "Oracle Dyn (Zenedge)",
    49: "Quantil",
    50: "QUIC.cloud",
    51: "Edgio",
    52: "SpeedyCloud CDN",
    53: "StackPath",
    54: "StackPath",
    55: "StackPath",
    56: "Atlassian Statuspage",
    57: "TAN14 CDN",
    58: "Tata Communications CDN",
    59: "TurboBytes",
    60: "UCloud",
    61: "UCloud",
    62: "Edgio",
    63: "VeryCloud",
    64: "ChinaCache CDN",
    65: "Vercel",
    66: "Zenlayer",
    67: "MmTrix",
    68: "Qiniu Cloud",
    69: "Shanghai Yundun CDN",
    70: "Shanghai Yundun CDN",
    71: "Shanghai Yundun CDN",
    72: "21Vianet CDN",
    73: "Microsoft Azure CDN",
    74: "CTYun CDN",
    75: "CTYun CDN",
    76: "ChinaMaincloud CDN",
    77: "Yunfan CDN",
    78: "Yunduan Zhidu CDN",
    79: "JD Cloud CDN",
    80: "Yisuyun CDN",
    81: "Wangsu CDN",
    82: "Chuangshi CDN",
    83: "PowerCDN",
    84: "CDNetworks",
    85: "Huawei Cloud CDN",
    86: "Huawei Cloud CDN",
    87: "UpYun",
    88: "Reliable Cloud CDN",
    89: "360/QAX WAF",
    90: "360/QAX WAF",
    91: "ByteDance CDN",
    92: "Anheng Cloud WAF",
    93: "CDN Union",
    94: "YaoCDN",
    95: "Diliun",
    96: "Fastweb CDN",
    97: "LeCloud CDN",
    98: "Xinliu CDN",
    99: "Sina Cloud CDN",
    100: "Sina Cloud CDN",
    101: "Sina Cloud CDN",
    102: "Sina Cloud CDN",
    103: "Fangneng CDN",
    104: "Akamai",
    105: "Xingyu CDN",
    106: "Jiyu Cloud WAF",
    107: "Jisudun WAF",
    108: "Sangfor",
    109: "NewDefend WAF",
    110: "Maoyun CDN",
    111: "BaishanCloud",
    112: "Baidu Cloud CDN",
    113: "Baidu Cloud CDN",
    114: "Baidu Cloud CDN",
    115: "KnowSec JiaSuLe",
    116: "KnowSec JiaSuLe",
    117: "KnowSec JiaSuLe",
    118: "NSFocus Cloud WAF",
    119: "Wangdi WAF",
    120: "Wangsu CDN",
    121: "Wangsu CDN",
    122: "NetEase Cloud CDN",
    123: "Meituan Cloud CDN",
    124: "Meituan Cloud CDN",
    125: "Meicheng CDN",
    126: "Meicheng CDN",
    127: "Tengzheng CDN",
    128: "Tencent Cloud CDN",
    129: "Tencent Cloud CDN",
    130: "Tencent Cloud CDN",
    131: "Tencent Cloud CDN",
    132: "Tencent Cloud CDN",
    133: "Tencent Cloud CDN",
    134: "Tencent Cloud CDN",
    135: "Tencent Cloud CDN",
    136: "Tencent Cloud CDN",
    137: "ChinaCache CDN",
    138: "Landun Cloud WAF",
    139: "Lanshiyun CDN",
    140: "Alipay GSLB",
    141: "ChinaMaincloud CDN",
    142: "West CN",
    143: "West CN",
    144: "Yiyun CDN",
    145: "Kingsoft Cloud CDN",
    146: "Ruisuyun WAF",
    147: "Alibaba Cloud CDN",
    148: "Alibaba Cloud CDN",
    149: "Alibaba Cloud CDN",
    150: "Alibaba Cloud CDN",
    151: "QingCloud",
    152: "Lingzhiyun CDN",
    153: "Ele.me GSLB",
    154: "Gosun CDN",
    155: "MomentCDN",
}

# Providers that only exist for DNS/CNAME detection (no response headers), so they
# never add false positives to the header scoring path. Name -> priority.
NEW_PROVIDERS = OrderedDict(
    [
        ("Wangsu CDN", 14),
        ("ChinaCache CDN", 10),
        ("360 Cloud CDN", 8),
        ("CDN.NET / CDNSUN", 8),
        ("CenturyLink CDN (Level 3)", 8),
        ("CTYun CDN", 8),
        ("Shanghai Yundun CDN", 8),
        ("21Vianet CDN", 7),
        ("Bilibili CDN", 7),
        ("Fastweb CDN", 7),
        ("Meituan Cloud CDN", 7),
        ("NetEase Cloud CDN", 7),
        ("Sangfor", 7),
        ("Sina Cloud CDN", 7),
        ("AT&T CDN", 6),
        ("Azion", 6),
        ("CDN Union", 6),
        ("CDNIFY", 6),
        ("Cedexis GSLB", 6),
        ("ChinaMaincloud CDN", 6),
        ("Chuangshi CDN", 6),
        ("Gosun CDN", 6),
        ("Instart Logic", 6),
        ("Internap CDN", 6),
        ("Lanshiyun CDN", 6),
        ("LeCloud CDN", 6),
        ("LeaseWeb CDN", 6),
        ("Maoyun CDN", 6),
        ("Microsoft Azure App Service", 6),
        ("MmTrix", 6),
        ("MomentCDN", 6),
        ("NodeCache", 6),
        ("Oracle Dyn (Zenedge)", 6),
        ("PowerCDN", 6),
        ("Reliable Cloud CDN", 6),
        ("SpeedyCloud CDN", 6),
        ("TAN14 CDN", 6),
        ("Tata Communications CDN", 6),
        ("Tengzheng CDN", 6),
        ("TurboBytes", 6),
        ("VeryCloud", 6),
        ("Xingyu CDN", 6),
        ("YaoCDN", 6),
        ("Yiyun CDN", 6),
        ("Yunfan CDN", 6),
        ("Yunduan Zhidu CDN", 6),
        ("360/QAX WAF", 6),
        ("Amazon Web Services", 5),
        ("Alipay GSLB", 5),
        ("Anheng Cloud WAF", 5),
        ("Atlassian Statuspage", 5),
        ("CloudXNS", 5),
        ("Coding Pages", 5),
        ("Ele.me GSLB", 5),
        ("Fangneng CDN", 5),
        ("FlexBalancer", 5),
        ("GitHub Pages", 5),
        ("GitLab Pages", 5),
        ("Google Cloud Storage", 5),
        ("Heroku", 5),
        ("Jisudun WAF", 5),
        ("Jiyu Cloud WAF", 5),
        ("Landun Cloud WAF", 5),
        ("Lingzhiyun CDN", 5),
        ("Meicheng CDN", 5),
        ("Microsoft Azure Traffic Manager", 5),
        ("NSFocus Cloud WAF", 5),
        ("NewDefend WAF", 5),
        ("Ruisuyun WAF", 5),
        ("West CN", 5),
        ("Wangdi WAF", 5),
        ("Xinliu CDN", 5),
        ("Yisuyun CDN", 5),
    ]
)

# Wangsu (ChinaNetCenter) suffixes that historically lived under CDNetworks.
REASSIGN_AWAY = {"CDNetworks": ["wsdvs", "wsglb0", "wscdns", "lxdns", "chinanetcenter", "cdn20", "wswebcdn"]}

# Suffixes that the collision test (tools/test_cname_matching.mjs) proved to be
# owned by somebody else, so they must not stay on the wrong provider:
#   hwcdn.net            -> Highwinds/StackPath, never Huawei
#   azurewebsites.net    -> Azure App Service, not Azure CDN
#   ccgslb / chinacache  -> 蓝汛 ChinaCache; EdgeNext keeps its own headers
CONFLICTING_REMOVALS = {
    "Huawei Cloud CDN": ["hwcdn"],
    "Microsoft Azure CDN": ["azurewebsites"],
    "EdgeNext": ["chinacache", "ccgslb"],
}

# Extra CNAME suffixes verified live over DNS-over-HTTPS on 2026-10-28 but absent
# from the ip438 table.
OBSERVED_ADDITIONS = {
    "Vercel": ["vercel-dns.com"],
    "Bilibili CDN": ["bilicdn1.com"],
    "Huawei Cloud CDN": ["huaweisafedns.cn"],
    "EdgeNext": ["edgenextcname.com", "bcdnx.com"],
    # ip438 lists "tdnsstic[1-4].cn.com", live DNS shows Tencent also uses *.tdnsstic1.cn.
    "Tencent Cloud CDN": ["tdnsstic*.cn"],
}


def normalize(pattern):
    """Turn ip438 bracket/regex syntax into the glob form the matcher uses."""
    s = pattern.strip().lower()
    s = re.sub(r"\[\^\.\]\+", "*", s)
    s = re.sub(r"\[[^\]]*\]", "*", s)
    s = re.sub(r"\([^)]*\)", "*", s)
    s = re.sub(r"\*+", "*", s)
    # Drop leftover regex metacharacters; patterns stay plain domain globs.
    s = re.sub(r"[^a-z0-9.\-*]", "", s)
    return s


def glob_to_regex(pattern):
    # Keep this in sync with cnameMatchesPattern() in cdn-server-info.user.js:
    # "*" expands only within a single DNS label, never across dots.
    body = "[a-z0-9_-]*".join(re.escape(part) for part in pattern.split("*"))
    return re.compile(r"^(?:.*\.)?" + body + r"$")


def covered_by(new, existing):
    """True when an existing pattern already matches everything the new one would."""
    probe = new.replace("*", "x")
    for old in existing:
        if old == new:
            return True
        if "*" in old:
            # A stored glob covers another pattern when the concrete shape still matches it.
            if glob_to_regex(old).match(probe):
                return True
            continue
        if "." not in old:
            # Bare label tokens ("akadns") already match every CNAME label, so
            # "akadns.net" adds nothing.
            if new.split(".")[0] == old:
                return True
        elif new.endswith("." + old):
            # Broader stored suffix ("dnsv1.com") covers a deeper new one.
            return True
    return False


def main():
    dry_run = "--dry-run" in sys.argv
    snap = json.load(open(SNAPSHOT, encoding="utf-8"))
    rules = json.load(open(RULES, encoding="utf-8"), object_pairs_hook=OrderedDict)
    rows = snap["rows"]

    missing = [i for i in range(len(rows)) if i not in ROW_TARGET]
    if missing:
        raise SystemExit(f"unmapped ip438 rows: {missing}")

    for provider, tokens in REASSIGN_AWAY.items():
        kept = [c for c in rules.get(provider, {}).get("cnames", []) if c not in tokens]
        removed = len(rules.get(provider, {}).get("cnames", [])) - len(kept)
        if removed and not dry_run:
            rules[provider]["cnames"] = kept
        print(f"reassigned {removed} Wangsu CNAME token(s) out of {provider}")

    for provider, tokens in CONFLICTING_REMOVALS.items():
        cnames = rules.get(provider, {}).get("cnames", [])
        kept = [c for c in cnames if c not in tokens]
        if len(kept) != len(cnames) and not dry_run:
            rules[provider]["cnames"] = kept
        print(f"removed {len(cnames) - len(kept)} mis-owned CNAME token(s) from {provider}")

    # ip438 rows first, then the live-verified extras.
    sources = [(ROW_TARGET[i], [normalize(p) for p in row["cnames"]]) for i, row in enumerate(rows)]
    sources += [(provider, list(patterns)) for provider, patterns in OBSERVED_ADDITIONS.items()]

    added = OrderedDict()
    skipped = []
    for target, raw_patterns in sources:
        for raw in raw_patterns:
            pattern = normalize(raw)
            bucket = added.setdefault(target, [])
            already = list(rules.get(target, {}).get("cnames", [])) + bucket
            if covered_by(pattern, already):
                skipped.append((target, pattern, "already covered"))
                continue
            # The new pattern may be broader than something already queued
            # ("tdnsv*.com" vs "tdnsv5.com"), so drop the narrower duplicates.
            dropped = [k for k in bucket if k != pattern and covered_by(k, [pattern])]
            bucket[:] = [k for k in bucket if k not in dropped]
            for k in dropped:
                skipped.append((target, k, "subsumed by " + pattern))
            bucket.append(pattern)

    new_providers = []
    for target, patterns in added.items():
        if not patterns:
            continue
        if target not in rules:
            if target not in NEW_PROVIDERS:
                raise SystemExit(f"provider {target!r} is neither existing nor declared in NEW_PROVIDERS")
            rules[target] = OrderedDict([("cnames", []), ("priority", NEW_PROVIDERS[target])])
            new_providers.append(target)
        rules[target].setdefault("cnames", [])
        if not dry_run:
            rules[target]["cnames"] = rules[target]["cnames"] + [p for p in patterns if p not in rules[target]["cnames"]]
        else:
            rules[target]["cnames"] = rules[target].get("cnames", []) + patterns

    # Stable, readable ordering: existing providers keep their place, DNS-only
    # additions are appended alphabetically.
    ordered = OrderedDict()
    for k, v in rules.items():
        ordered[k] = v
    if not dry_run:
        text = json.dumps(ordered, ensure_ascii=False, indent=4) + "\n"
        open(RULES, "w", encoding="utf-8").write(text)

    total_new = sum(len(p) for p in added.values() if p)
    print(f"\nproviders: {len(rules)} (new DNS-only: {len(new_providers)})")
    print(f"cname patterns added: {total_new}, skipped as already covered: {len(skipped)}")
    if new_providers:
        print("new providers: " + ", ".join(sorted(new_providers)))
    for target, patterns in added.items():
        if patterns:
            print(f"  {target}: +{', '.join(patterns)}")
    if dry_run:
        print("\n(dry run, cdn_rules.json untouched)")
    print("\nskipped patterns:")
    for target, pattern, why in skipped:
        print(f"  {target}: {pattern} ({why})")
    if not dry_run:
        print("\nnext: npx prettier --write cdn_rules.json && node tools/test_cname_matching.mjs")


if __name__ == "__main__":
    main()
