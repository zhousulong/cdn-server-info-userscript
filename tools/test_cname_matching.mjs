#!/usr/bin/env node
// Validate cdn_rules.json CNAME matching with the matcher that ships in the userscript.
//
//   node tools/test_cname_matching.mjs
//
// Checks:
//   1. every stored pattern matches a concrete CNAME of its own provider, and that
//      provider wins the priority contest (catches cross-provider shadowing);
//   2. a fixture list of real-world CNAMEs resolves to the expected provider.
import fs from 'node:fs';

const rulesFile = new URL('../cdn_rules.json', import.meta.url);
const scriptFile = new URL('../cdn-server-info.user.js', import.meta.url);

const rules = JSON.parse(fs.readFileSync(rulesFile, 'utf8'));
const source = fs.readFileSync(scriptFile, 'utf8');

// Load the shipped matcher instead of duplicating it in the test.
const snippet = source.match(
    /const globPatternCache = new Map\(\);[\s\S]*?\n {4}function cnameMatchesPattern[\s\S]*?\n {4}}/
);
if (!snippet) {
    throw new Error('cnameMatchesPattern not found in cdn-server-info.user.js');
}
const cnameMatchesPattern = new Function(`${snippet[0]}; return cnameMatchesPattern;`)();

function detect(cname) {
    const lower = cname.toLowerCase().replace(/\.$/, '');
    const labels = lower.split('.');
    const candidates = [];
    for (const [provider, rule] of Object.entries(rules)) {
        if (!Array.isArray(rule.cnames)) continue;
        for (const pattern of rule.cnames) {
            if (cnameMatchesPattern(lower, labels, pattern)) {
                candidates.push({ provider, pattern, priority: rule.priority || 0 });
                break;
            }
        }
    }
    candidates.sort((a, b) => b.priority - a.priority);
    return candidates;
}

function probeFor(provider, pattern) {
    const domain = pattern.includes('*') ? pattern.replace(/\*/g, 'x') : pattern;
    return domain.includes('.') ? `www.${domain}` : `www.${domain}.net`;
}

let failures = 0;
const report = [];

for (const [provider, rule] of Object.entries(rules)) {
    for (const pattern of rule.cnames || []) {
        const probe = probeFor(provider, pattern);
        const candidates = detect(probe);
        const winner = candidates[0];
        if (!winner || winner.provider !== provider) {
            failures++;
            report.push(
                `FAIL ${provider} :: ${pattern} -> ${probe} matched ` +
                    (winner
                        ? `${winner.provider} (${winner.pattern}, prio ${winner.priority})`
                        : 'nothing')
            );
        } else if (candidates.length > 1) {
            report.push(
                `note ${provider} :: ${pattern} also matched by ` +
                    candidates
                        .slice(1)
                        .map((c) => `${c.provider}/${c.pattern}`)
                        .join(', ')
            );
        }
    }
}

// CNAME values (not the queried domain). The first block was captured live with
// DNS-over-HTTPS on 2026-10-28, the rest are documented vendor suffixes.
const fixtures = [
    // live DoH answers
    ['www.taobao.com.danuoyi.tbcache.com', 'Alibaba Cloud CDN'],
    ['www.a.shifen.com', 'Baidu Cloud CDN'],
    ['i.w.bilicdn1.com', 'Bilibili CDN'],
    ['static.youzu.com.wscdns.com', 'Wangsu CDN'],
    ['static.jd.com.gslb.qianxun.com', 'JD Cloud CDN'],
    ['89f45538.edgenext.com', 'EdgeNext'],
    ['docs.edgenext.com.bcdnx.com', 'EdgeNext'],
    ['c8b9e2214a25475d.huaweisafedns.cn', 'Huawei Cloud CDN'],
    ['sites-frp-lining-calculator-p7c0wx.b-cdn.net', 'BunnyCDN'],
    // vendor suffixes seen in the wild
    ['example.cloudfront.net', 'AWS CloudFront'],
    ['example.cdn.cloudflare.net', 'Cloudflare'],
    ['www.example.com.cdn.dnsv1.com', 'Tencent Cloud CDN'],
    ['example.dnse1.com', 'Tencent Cloud CDN'],
    ['example.tdnsv5.com', 'Tencent Cloud CDN'],
    ['example.tdnsstic1.cn', 'Tencent Cloud CDN'],
    ['example.kunlunaq.com', 'Alibaba Cloud CDN'],
    ['example.gtm-a2b4.com', 'Alibaba Cloud CDN'],
    ['example.yundunwaf1.com', 'Alibaba Cloud CDN'],
    ['example.mwcname.com', 'Quantil'],
    ['example.cdn77.org', 'CDN77'],
    ['example.edgenextcname.com', 'EdgeNext'],
    ['example.azureedge.net', 'Microsoft Azure CDN'],
    ['example.azurewebsites.net', 'Microsoft Azure App Service'],
    ['example.cachefly.net', 'CacheFly'],
    ['example.momentcdn.com', 'MomentCDN'],
    ['example.tl88.net', 'Akamai'],
    ['example.lxdns.com', 'Wangsu CDN'],
    ['example.ccgslb.com', 'ChinaCache CDN'],
    ['example.xgslb.net', 'ChinaCache CDN'],
    ['example.cdnetworks.net', 'CDNetworks'],
    ['example.hwcdn.net', 'StackPath'],
    ['example.azioncdn.net', 'Azion'],
    ['example.sangfordns.com', 'Sangfor'],
    ['example.yisuddoscdn.com', 'Yisuyun CDN'],
    ['example.uxengine.net', 'Zenlayer'],
    ['example.swiftycdn.net', 'Melbicom'],
    ['example.vedcdnlb.com', 'ByteDance CDN'],
    ['example.volcmcdn1.com', 'ByteDance CDN'],
    ['example.bsclink.cn', 'BaishanCloud'],
    ['example.qingcache.com', 'QingCloud'],
    ['example.frontwize.com', 'QingCloud'],
    ['example.ucloudgda.com', 'UCloud'],
    ['example.jdcdn.com', 'JD Cloud CDN'],
    ['example.cdnhwcaoc115.cn', 'Huawei Cloud CDN'],
    ['example.yunduncdn.com', 'Shanghai Yundun CDN'],
    ['example.hcnamedns.com', 'Shanghai Yundun CDN'],
    ['example.spdydns.com', 'Yunduan Zhidu CDN'],
    ['example.turbobytes.net', 'TurboBytes'],
    ['example.footprint.net', 'CenturyLink CDN (Level 3)'],
    ['example.bitgravity.com', 'Tata Communications CDN'],
    ['example.insnw.net', 'Instart Logic'],
    ['example.zenedge.net', 'Oracle Dyn (Zenedge)'],
    ['example.xundayun.com', 'SpeedyCloud CDN'],
    ['example.simplecdn.net', 'Edgio'],
    ['example.edgecastcdn.net', 'Edgio'],
    ['example.netdna-cdn.com', 'StackPath'],
    ['example.kxcdn.com', 'KeyCDN'],
    ['example.gcdn.co', 'Gcore'],
    ['example.incapdns.net', 'Imperva'],
    ['example.fastlylb.net', 'Fastly'],
    ['cname.vercel-dns.com', 'Vercel'],
    ['example.zeit.co', 'Vercel'],
    ['example.github.io', 'GitHub Pages'],
    ['example.netlify.com', 'Netlify'],
    ['example.quic.cloud', 'QUIC.cloud'],
    ['example.myqcloud.com', 'Tencent Cloud CDN'],
    ['example.worldssl.net', 'CDN.NET / CDNSUN'],
    ['example.vhostgo.com', 'West CN'],
    ['example.qaxwzws.com', '360/QAX WAF'],
    ['example.jiashule.com', 'KnowSec JiaSuLe'],
    ['example.pcwaf.com', 'Ruisuyun WAF'],
    ['example.maoyundns.com', 'Maoyun CDN'],
    ['example.elemecdn.com', 'Ele.me GSLB'],
    ['example.alipaydns.com', 'Alipay GSLB'],
    ['example.scsdns.com', 'Yiyun CDN'],
    ['example.fnvip100.com', 'Fangneng CDN'],
    ['example.126.net', 'NetEase Cloud CDN'],
    ['example.msscdn.com', 'Meituan Cloud CDN'],
    ['example.sinaedge.com', 'Sina Cloud CDN'],
    ['example.fastwebcdn.com', 'Fastweb CDN'],
    ['example.tlgslb.com', 'Diliun'],
    ['example.21speedcdn.com', '21Vianet CDN'],
    ['example.ctxcdn.cn', 'CTYun CDN'],
    ['example.mmycdn.cn', 'ChinaMaincloud CDN'],
    ['example.verygslb.com', 'VeryCloud'],
    ['example.stspg-customer.com', 'Atlassian Statuspage'],
    ['example.att-dsa.net', 'AT&T CDN'],
    ['example.s3.amazonaws.com', 'Amazon Web Services'],
    ['example.googleapis.com', 'Google Cloud Storage'],
    ['example.lswcdn.net', 'LeaseWeb CDN'],
    ['example.cdnify.io', 'CDNIFY'],
    ['example.cedexis.net', 'Cedexis GSLB'],
    ['example.ncname.com', 'NodeCache'],
    ['example.tan14.net', 'TAN14 CDN'],
    ['example.flexbalancer.net', 'FlexBalancer'],
    ['example.trafficmanager.net', 'Microsoft Azure Traffic Manager'],
];

for (const [cname, expected] of fixtures) {
    const winner = detect(cname)[0];
    const got = winner ? winner.provider : null;
    if (got !== expected) {
        failures++;
        report.push(`FAIL fixture ${cname}: expected ${expected}, got ${got}`);
    }
}

const patternCount = Object.values(rules).reduce((n, r) => n + (r.cnames || []).length, 0);
console.log(`providers: ${Object.keys(rules).length}, cname patterns: ${patternCount}`);
report.forEach((line) => console.log(line));
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
