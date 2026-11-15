// Customer-service questions the way agents actually ask them -> the CS manual topic the AI's search must find.
// Run: node test/cs-bench.js   (prints misses and the hit rate; test.js also requires 90%+)
module.exports = [
  ['client cannot afford to pay premium anymore but want to keep some cover', /paid.?up|extended term/i],
  ['客户不想再缴保费了，保单还有效吗', /paid.?up|extended term/i],
  ['client want to cash out the policy and close it', /surrender/i],
  ['nak tutup polisi ambil duit balik', /surrender/i],
  ['客户要退保要准备什么', /surrender/i],
  ['client need money urgently can borrow from policy?', /policy loan/i],
  ['保单贷款怎么申请', /policy loan/i],
  ['ILP client want to take out some money from fund', /partial withdrawal|withdrawal/i],
  ['client want to put extra lump sum into ILP', /single premium top.?up|top.?up/i],
  ['how to switch fund for investment linked policy', /switching of funds|switch/i],
  ['客户想换基金', /switching of funds|switch/i],
  ['client policy lapsed how to revive', /reinstatement|revival/i],
  ['polisi luput macam mana nak hidupkan balik', /reinstatement|revival/i],
  ['保单断了怎么复效', /reinstatement|revival/i],
  ['client want to add rider to existing policy', /inclusion of benefits/i],
  ['want to remove medical rider from ILP', /cancellation of (il )?riders?|cancel|cancellation of benefits/i],
  ['client want to increase coverage', /increase in sum assured/i],
  ['客户要减少保额', /decrease in sum assured/i],
  ['reduce sum assured to lower premium', /decrease in sum assured/i],
  ['change owner of the policy from father to son', /transfer of ownership/i],
  ['tukar pemilik polisi', /transfer of ownership/i],
  ['client gender wrong in policy', /gender|birth date|correction of life assured/i],
  ['date of birth wrong in policy how to correct', /gender|birth date|correction of life assured/i],
  ['client quit smoking can get cheaper premium?', /smoker/i],
  ['client changed job to more risky work', /occupation class/i],
  ['upgrade medical card room and board', /upgrad|downgrad|medical card/i],
  ['client lost the policy book', /duplicate policy/i],
  ['客户保单不见了', /duplicate policy/i],
  ['change premium payment from monthly to yearly', /frequency of payment/i],
  ['set up GIRO for premium', /giro/i],
  ['easipay credit card instalment', /easi ?pay/i],
  ['client signature changed', /change of signature/i],
  ['client want cancel policy within 15 days', /free.?look|freelook/i],
  ['client want to change to another plan', /change of plan/i],
  ['convert term plan to whole life', /conversion privileges/i],
  ['backdate policy start date', /commencement date/i],
  ['client did not declare medical condition when applying', /non.?disclosure/i],
  ['client want to update car number for policy', /car registration/i],
  ['family discount for medical plan', /family discount/i],
  ['client wants to stop receiving marketing calls', /marketing consent|pdpa/i],
  // fresh wording, written after the index was built (to check it is not just tuned to the questions above)
  ['my client retrenched cannot continue paying what options', /paid.?up|extended term|change in regular premium|decrease/i],
  ['客户想把保单转给太太', /transfer of ownership/i],
  ['boleh pinjam duit dari polisi?', /policy loan/i],
  ['client ILP want move from equity fund to bond fund', /switching/i],
  ['how long can lapse policy still reinstate', /reinstatement/i],
  ['client IC number changed new MyKad', /person.*particulars|correction of person/i],
  ['客户想加危疾附加保障', /inclusion of benefits/i],
  ['top up extra 10k into investment linked plan', /top.?up/i],
  ['client regret want refund full premium', /free.?look/i],
  ['nak naik taraf kad perubatan', /upgrad|medical card/i],
  ['beneficiary IC number typo', /nominee|trustee/i],
  ['client now smoking need to inform?', /smoker/i],
  ['want pay premium by credit card monthly instalment', /easi ?pay/i],
  ['client want to take bonus cash', /bonus/i],
  ['child policy transfer to child when 18', /vesting|transfer of ownership/i]
];

if (require.main === module) {
  const S = require('./server-sim.js'); S.preload();
  let hit = 0; const misses = [];
  for (const [q, re] of module.exports) {
    const r = S.call({code: 'test-team-code', op: 'ioask', question: q});
    const top = r.sources.slice(0, 3).map(s => s.h);
    if (top.some(h => re.test(h))) hit++; else misses.push(`MISS ${q}\n     -> ${top.map(h => h.slice(0, 70)).join(' / ')}`);
  }
  console.log(misses.join('\n'));
  console.log(`${hit}/${module.exports.length} found in the top 3 (${Math.round(hit * 100 / module.exports.length)}%)`);
}
