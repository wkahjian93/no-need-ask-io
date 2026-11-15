// CS transaction index for the AI library: one entry per Customer Service transaction, built from GE's CS manual
// guides + FAQs (private/source/docs-nov15-csm/*.txt). Each entry says what agents call it (English / 中文 / BM),
// which GE documents cover it and their dates, the guide's key rules, and the questions its FAQ answers.
// Agents ask "client cannot afford to pay anymore"; the manual says "Paid-Up Assurance" - this bridges the two.
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'private', 'source', 'docs-nov15-csm');

// t: transaction, f: file name patterns (guide first), a: what agents say
const TOPICS = [
  {t: 'Paid-Up Assurance (stop paying, keep a reduced cover) - traditional policies', f: [/^Paid-Up Assurance/, /^FAQ Paid Up Assurance/], a: 'stop paying premium, cannot afford to pay anymore, no more premium but keep cover, reduced sum assured, paid up, 停缴, 不想再缴保费, 不能再付, 不缴了, berhenti bayar premium, tak mampu bayar'},
  {t: 'Extended Term Assurance (stop paying, keep full cover for a shorter time) - traditional policies', f: [/^Extended Term Assurance/, /^FAQ Extended Term Assurance/], a: 'stop paying premium but keep full cover for some years, ETA, cannot afford to pay anymore, 停缴保费 保障继续, berhenti bayar'},
  {t: 'Policy Surrender (cash out and end a traditional policy)', f: [/^Policy Surrender/, /^FAQ Policy Surrender/], a: 'cash out, close the policy, terminate, take money back, surrender value, 退保, 退保金, 拿回钱, tutup polisi, ambil duit balik, serah balik polisi'},
  {t: 'Full Withdrawal of an Investment-Linked (ILP) policy (close ILP, take all the fund value)', f: [/^Full Withdrawal of IL/, /^FAQ Full Withdrawal/], a: 'close ILP, surrender ILP, take all money from fund, terminate investment linked, ILP 退保, 全部提款, tutup polisi ILP'},
  {t: 'Partial Surrender (take part of the cash value) - traditional policies', f: [/^Partial Surrender/, /^FAQ Partial Surrender/], a: 'take some cash value, partial cash out, 部分退保, keluarkan sebahagian nilai tunai'},
  {t: 'Partial Withdrawal from an Investment-Linked (ILP) fund', f: [/^Partial Withdrawal/, /^FAQ Partial Withdrawal/], a: 'take out some money from fund, withdraw part of ILP, need cash from investment, 部分提款, 提款, keluarkan duit dari dana'},
  {t: 'Revival of Partial Surrender (put back a partial surrender)', f: [/^CS Guide - Revival of Partial Surrender/, /^CS FAQ - Revival of Partial Surrender/], a: 'undo partial surrender, buy back, restore cash value, 恢复部分退保'},
  {t: 'Reinstatement of a Lapsed Policy (revive)', f: [/^CS Guide - Reinstatement/, /^CS FAQ - Reinstatement/], a: 'policy lapsed, revive, reinstate, bring policy back, missed premiums, 复效, 断保, 保单失效, polisi luput, hidupkan semula polisi'},
  {t: 'Policy Loan (borrow against the policy)', f: [/^Guide - Policy Loan/, /^FAQ - Policy Loan/], a: 'borrow money from policy, need money urgently, loan, cash loan, 保单贷款, 借钱, pinjaman polisi'},
  {t: 'Surrender of Bonus (cash out accumulated bonus)', f: [/^Surrender of Bonus/, /^FAQ Surrender of Bonus/], a: 'cash out bonus, take bonus, 领取红利, 红利, ambil bonus'},
  {t: 'Free-look Cancellation (cancel within the free-look period)', f: [/^Cancellation of Policy within Freelook/, /^FAQ - Cancellation of Policy within Freelook/], a: 'cancel within 15 days, cooling off, free look, freelook, regret buying, full refund, 犹豫期, 冷静期, 15天内取消, tempoh bertenang, batal dalam 15 hari'},
  {t: 'Inclusion of Benefits (add a rider) - traditional policies', f: [/^Inclusion of Benefits/, /^FAQ Inclusion of Benefits/], a: 'add rider, add medical card, add coverage to existing policy, 加附加保障, 加医药卡, tambah rider'},
  {t: 'Inclusion of Benefits (add a rider) - Investment-Linked (ILP)', f: [/^IL-Inclusion of Benefits/, /^FAQ IL Inclusion Of Benefits/], a: 'add rider to ILP, add medical card ILP, ILP 加附加, tambah rider ILP'},
  {t: 'Cancellation of Rider - traditional policies', f: [/^Cancellation of Rider/], a: 'remove rider, cancel rider, drop rider, stop medical card, 取消附加, 删除附加, batal rider'},
  {t: 'Cancellation of Riders / Benefits - Investment-Linked (ILP)', f: [/^Cancellation of IL Riders/, /^FAQ IL Cancellation of Benefits/], a: 'remove rider from ILP, cancel ILP medical rider, cancel benefit, ILP 取消附加, batal rider ILP'},
  {t: 'Increase in Sum Assured - traditional policies', f: [/^Increase in Sum Assured/, /^FAQ Increase in Sum Assured/], a: 'increase coverage, more cover, higher sum assured, 加保额, 增加保额, tambah perlindungan'},
  {t: 'Increase in Sum Assured - Investment-Linked (ILP)', f: [/^IL-Increase in Sum Assured/, /^FAQ IL Increase In Sum Assured/], a: 'increase ILP coverage, ILP 加保额, tambah perlindungan ILP'},
  {t: 'Decrease in Sum Assured - traditional policies', f: [/^Decrease in Sum Assured/, /^FAQ Decrease in Sum Assured/], a: 'reduce coverage, lower sum assured, reduce premium, 减保额, 减少保额, kurangkan perlindungan'},
  {t: 'Decrease in Sum Assured - Investment-Linked (ILP)', f: [/^FAQ IL Decrease in Sum Assured/], a: 'reduce ILP coverage, ILP 减保额, kurangkan perlindungan ILP'},
  {t: 'Change in Regular Premium (increase or reduce the premium amount)', f: [/^Change in Regular Premium/, /^FAQ IL Change In Regular Premium/], a: 'increase premium, reduce premium, change premium amount, pay less, 加保费, 减保费, 调整保费, tukar jumlah premium'},
  {t: 'Single Premium Top-up - Investment-Linked (ILP)', f: [/^Single Premium Top-up/, /^FAQ IL Single Premium Top-Up/], a: 'put extra lump sum into ILP, top up, add money to fund, 加额外投资, 一次性加钱, tambah duit pelaburan'},
  {t: 'Switching of Funds - Investment-Linked (ILP)', f: [/^Switching of Funds/, /^FAQ IL Switching of Funds/], a: 'switch fund, change fund, move money to another fund, 换基金, 基金转换, tukar dana'},
  {t: 'Premium Apportionment - Investment-Linked (ILP)', f: [/^Premium Apportionment/, /^FAQ IL Premium Apportionment/], a: 'change fund allocation of future premium, apportionment, 保费分配, peruntukan dana'},
  {t: 'Guaranteed Insurability Benefit (GIB) Option (increase cover without medical underwriting)', f: [/^Guaranteed Insurability Benefit/, /^FAQ IL Guaranteed Insurability/], a: 'increase cover without medical check, life event marriage child, GIB, 免体检加保'},
  {t: 'Include / Cancel GSR (with Waiver) - Investment-Linked (ILP)', f: [/^FAQ IL Include and Cancel GSR/], a: 'GSR, guaranteed savings rider, waiver, add or cancel GSR'},
  {t: 'GJA Option', f: [/^FAQ GJA Option/], a: 'GJA option, GJA'},
  {t: 'Option to Purchase', f: [/^Option To Purchase/, /^FAQ Option to Purchase/], a: 'option to purchase, OTP, buy new policy without medical'},
  {t: 'Conversion Privileges (convert to another plan, e.g. term to whole life)', f: [/^Conversion Privileges/, /^FAQ Conversion Privileges/], a: 'convert term plan to whole life, conversion, 转换计划, tukar pelan'},
  {t: 'Change of Plan', f: [/^Change of Plan/, /^FAQ Change of Plan/], a: 'change to another plan, switch plan, 换计划, tukar pelan'},
  {t: 'Change of Term - traditional policies', f: [/^Change Term 12JAN26/, /^FAQ Change of Term 12JAN26/], a: 'shorten or extend coverage term, change policy term, 改年期, tukar tempoh'},
  {t: 'Change of Term - Investment-Linked (ILP)', f: [/^Change Term in ILP/, /^FAQ Change of Term in ILP/], a: 'change ILP coverage term, ILP 改年期'},
  {t: 'Upgrade / Downgrade Medical Card or Standalone Medical Policy', f: [/^Upgrading and Downgrading/, /^FAQ Upgrade Downgrade Medical Card/], a: 'upgrade medical card, room and board, higher plan, downgrade, 升级医药卡, 降级, naik taraf kad perubatan'},
  {t: 'Family Discount for Health Plan', f: [/^Family Discount/, /^FAQ Family Discount/], a: 'family discount medical plan, 家庭折扣, diskaun keluarga'},
  {t: 'Smoker / Non-Smoker Rate (smoker rebate)', f: [/^Smoker Rate/, /^FAQ Smoker and Non-Smoker/], a: 'quit smoking, cheaper premium after stop smoking, smoker to non-smoker, 戒烟, 吸烟, berhenti merokok'},
  {t: 'Change in Occupation Class', f: [/^Change in Occupation Class/, /^FAQ Change in Occupation Class/], a: 'client changed job, new occupation, risky job, 换工作, 职业变了, tukar kerja, pekerjaan baru'},
  {t: 'Extra Premiums (loading) and their removal', f: [/^Extra Premiums/, /^FAQ Extra Premiums/], a: 'loading, extra premium, remove loading, 加费, premium tambahan'},
  {t: 'Amendment of Policy Commencement Date (backdating)', f: [/^Amendment of Policy Commencement Date/, /^FAQ Amendment of Policy Commencement Date/], a: 'backdate, change start date, commencement date, 改生效日期, 倒签, tarikh mula polisi'},
  {t: 'Correction of Life Assured Gender or Birth Date', f: [/^Correction of Life Assured/, /^FAQ Correction of Life Assured Gender/], a: 'gender wrong, date of birth wrong, age wrong, 性别错, 出生日期错, jantina salah, tarikh lahir salah'},
  {t: 'Correction of Person / Company Particulars (name, IC, passport, company ID)', f: [/^Guide - Correction of Person Particulars/, /^FAQ - Correction of Person_Company/, /^FAQ Correction of Person Particulars/], a: 'name wrong, new IC, change IC number, passport, company registration, 名字错, 资料错, 更改身份证, butiran salah'},
  {t: 'Correction of Nominee / Trustee Particulars', f: [/^Correction Of NomineeTrustee/], a: 'nominee name wrong, nominee IC wrong, 受益人资料错, butiran penama salah'},
  {t: 'Change of Signature', f: [/^Change of Signature/, /^FAQ Change of Signature/], a: 'client signature changed, new signature, signature not match, 签名, tandatangan'},
  {t: 'Change of Email Address and Contact Number', f: [/^FAQ Change of Email Address/], a: 'update email, new phone number, contact number, 电邮, 电话号码, emel, nombor telefon'},
  {t: 'Transfer of Ownership (change policy owner)', f: [/^Guide - Transfer of Ownership/, /^FAQ - Transfer of Ownership/], a: 'change owner, father to son, transfer policy to someone, 转换保单持有人, 换持有人, tukar pemilik polisi'},
  {t: 'Vesting Clause (policy passes to the child at a set age)', f: [/^FAQ Vesting Clause/], a: 'vesting, child takes over policy, 转名给孩子, vesting clause'},
  {t: 'Request for Duplicate Policy (lost policy contract)', f: [/^Guide - Request for Duplicate Policy/, /^FAQ - Request for Duplicate Policy/], a: 'lost the policy book, policy contract missing, reprint, 保单不见了, 遗失保单, polisi hilang'},
  {t: 'GIRO (bank auto-debit for premium)', f: [/^Guide - GIRO/, /^FAQ GIRO/], a: 'giro, auto debit from bank account, 银行自动扣款, debit terus'},
  {t: 'EasiPay (credit card instalment for premium)', f: [/^Guide - Easi Pay/, /^FAQ - Easipay/], a: 'easipay, credit card instalment, 信用卡分期, ansuran kad kredit'},
  {t: 'Car Registration', f: [/^Guide - Car Registration/, /^FAQ - Car Registration/], a: 'car number, vehicle registration, update car plate, 车牌, nombor kereta'},
  {t: 'Non-Disclosure of Material Facts', f: [/^Non-Disclosure of Material Facts/, /^FAQ Non-Disclosure/], a: 'did not declare medical condition, hide illness, non disclosure, 隐瞒病史, 没申报, tidak isytihar'},
  {t: 'Update Marketing Consent (PDPA)', f: [/^FAQ Update Marketing Consent/], a: 'stop marketing calls, PDPA, consent, opt out, 不要推销, 营销同意'}
];

const tidy = s => s.replace(/\b((?:[A-Za-z0-9] ){3,}[A-Za-z0-9])\b/g, m => m.replace(/ /g, '')) // "P a i d - U p" -> "Paid-Up"
  .replace(/--- page \d+ ---/g, ' ').replace(/Page \|? ?\d+ of \d+/gi, ' ').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dateOf(name) { // "01012026" -> "1 Jan 2026", "12JAN26" -> "12 Jan 2026", "3MAR" -> "3 Mar"
  let m = name.match(/(?:^|[^0-9])(\d{2})(\d{2})(20\d{2})(?![0-9])/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${+m[1]} ${MON[+m[2] - 1]} ${m[3]}`;
  m = name.match(/(\d{1,2})(JAN|FEB|MAR|APR|MAY|JUNE?|JULY?|AUG|SEPT?|OCT|NOV|DEC)(\d{2})?(?![A-Z])/i);
  if (m) return `${+m[1]} ${m[2][0].toUpperCase() + m[2].slice(1, 3).toLowerCase()}${m[3] ? ' 20' + m[3] : ''}`;
  return '';
}

function topics() {
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.txt')) : [];
  const used = new Set(), out = [];
  for (const T of TOPICS) {
    const docs = T.f.map(re => files.filter(f => re.test(f) && !used.has(f))).flat();
    docs.forEach(f => used.add(f));
    if (!docs.length) continue;
    const texts = docs.map(f => ({name: f.replace(/\.txt$/, ''), text: tidy(fs.readFileSync(path.join(DIR, f), 'utf8'))}));
    const guide = texts.find(d => !/^(CS )?FAQ/i.test(d.name)) || texts[0];
    const faqs = texts.filter(d => /FAQ/i.test(d.name));
    const qs = faqs.flatMap(d => [...d.text.matchAll(/Question\s*:?\s*([^\n?]{8,200}\?)/gi)].map(m => m[1].replace(/\s+/g, ' ').trim())).slice(0, 25);
    const forms = [...new Set(texts.flatMap(d => d.text.match(/\b[A-Z]{2,4}-[A-Z]{2,5}\d{1,3}[A-Z]?(?:-V\d+)?\b/g) || []))].slice(0, 6);
    const x = [
      `CS transaction: ${T.t}`,
      `Agents also call it: ${T.a}.`,
      `GE documents: ${texts.map(d => d.name + (dateOf(d.name) ? ` (${dateOf(d.name)})` : '')).join('; ')}.` + (forms.length ? ` Form codes mentioned: ${forms.join(', ')}.` : ''),
      `Key rules from ${guide.name}: ${guide.text.slice(0, 1700)}`,
      qs.length ? `The FAQ answers: ${qs.join(' | ')}` : ''
    ].filter(Boolean).join('\n');
    out.push({h: `CS transaction: ${T.t}`, x});
  }
  return {topics: out, unused: files.filter(f => !used.has(f))};
}

module.exports = {topics, TOPICS};
if (require.main === module) {
  const r = topics();
  console.log(r.topics.length, 'topics;', 'files not in any topic:', r.unused.length, r.unused.join(' | '));
  console.log(r.topics.find(t => /Paid-Up/.test(t.h)).x.slice(0, 1500));
}
