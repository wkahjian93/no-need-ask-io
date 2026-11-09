// Chinese / Malay / Manglish words -> English search words used in ePartner. Used by the phone (instant guides)
// and by the team server (library search for AI answers). Keys are matched as substrings of the question.
module.exports = {
  '佣金': 'commission', '收入': 'income commission', '粮': 'commission disbursement', '糧': 'commission disbursement', 'komisen': 'commission', 'gaji': 'commission income',
  '表格': 'form', '表': 'form', 'borang': 'form',
  '登录': 'login', '登入': 'login', '登陆': 'login', '密码': 'password', '进不去': 'login', '开不到': 'login error', 'log masuk': 'login', 'kata laluan': 'password',
  '保单': 'policy', 'polisi': 'policy', '电子保单': 'e-policy policy contract', '下载': 'download', 'muat turun': 'download',
  '理赔': 'claim', '索赔': 'claim', '赔偿': 'claim', 'tuntutan': 'claim', '死亡': 'death', '住院': 'hospital admission hospitalisation', '医院': 'hospital panel', '诊所': 'clinic panel', 'klinik': 'clinic panel',
  '核保': 'underwriting', '体检': 'medical examination underwriting', '验身': 'medical examination', '验血': 'blood test', 'pemeriksaan': 'medical examination',
  '受益人': 'nominee nomination', '提名': 'nomination nominee', 'penamaan': 'nomination', '信托': 'trustee', '转让': 'assignment transfer ownership',
  '退保': 'surrender', '部分提款': 'partial withdrawal', '提款': 'withdrawal', '复效': 'reinstatement revival', '断保': 'lapse', 'luput': 'lapse', 'serah balik': 'surrender',
  '保费': 'premium', '到期': 'due date', '扣款': 'auto debit', '自动扣款': 'auto debit', '缴费': 'premium payment', 'premium due': 'due date',
  '客户': 'customer client', '资料': 'details', 'pelanggan': 'customer client', 'butiran': 'details',
  '电话': 'hotline careline phone', '热线': 'hotline careline', '客服': 'customer service', 'talian': 'hotline',
  '产品': 'product', '计划': 'plan product', '投资联结': 'investment-linked ilp', '基金': 'fund', '净值': 'unit price fund',
  '课程': 'course training', '培训': 'training course', 'kursus': 'course', '考试': 'exam ceilli pce',
  '状态': 'status', '进度': 'status', '提交': 'submission submit', '上诉': 'appeal', '查询': 'enquiry query',
  '报税': 'tax relief premium paid statement', '扣税': 'tax relief', 'cukai': 'tax',
  '替换': 'replacement rop', '换保单': 'replacement rop', '非面对面': 'nftf non face-to-face',
  '收件箱': 'inbox', '信件': 'letter inbox', '通知': 'notice inbox', 'surat': 'letter inbox',
  '更改': 'change alteration', '地址': 'address', '加保': 'increase sum assured top-up', '附加': 'rider', '医药卡': 'medical card',
  'nak': '', 'macam mana': 'how', 'mcm mana': 'how', 'camne': 'how', 'how to': 'how', '怎样': 'how', '怎么': 'how', '哪里': 'where', '在哪': 'where'
};

// Plan abbreviations agents type -> the words used in GE's product PDFs.
Object.assign(module.exports, {
  'spye2': 'smartprotect you exclusive 2 8036', 'spye': 'smartprotect you exclusive 0560', 'spy-100': 'smartprotect you 8004 0519', 'spy100': 'smartprotect you 8004 0519', 'spy-80': 'smartprotect you 0531 8006', 'spy': 'smartprotect you',
  'spwp': 'smartprotect wealth plus 0525', 'spwmcie': 'smartprotect wealth max ci exclusive 0556', 'spwm': 'smartprotect wealth max 0537', 'sps': 'smartprotect sure 0509',
  'srmse': 'smart revive max secure exclusive 0564', 'srm': 'smart revive max 0562', 'phg': 'prestige heritage global 0565', 'swg': 'smart wealth global 8031', 'pwg': 'prestige wealth global 8033',
  'sip3': 'smartinvest premier 3 0498', 'sig': 'smartinvest growth 0283', 'spj': 'smartprotect junior 0495', 'shp': 'smart health protector', 'gmv': 'great medivalue medivalue',
  'grp': 'great retirement pride 8016', 'gre6': 'great returns extra 6 8028', 'gmgw3': 'great multi-gen wealth 3 8019', 'gwe': 'great wealth enhancer 0549', 'gtg': 'great treasure gift 8012', 'glg': 'great life gift 0515',
  'gccr': 'great critical care relief 0550', 'gmcc': 'great multi cancer care 0534', 'ggc': 'great generations care 0505', 'gvc2': 'great vantagecare 2 0460', 'gevc2': 'great early vantagecare 2 0461', 'gsc': 'great securecare 0402',
  'gmls': 'great medic lite secure', 'gms2': 'great medic shield 2', 'ltcr': 'long term care rider u944', 'free look': 'free-look free look cancellation', 'freelook': 'free-look free look cancellation'
});
