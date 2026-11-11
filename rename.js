/**
 * 更新日期：2024-04-05 15:30:15
 * 用法：Sub-Store 脚本操作添加
 * rename.js 以下是此脚本支持的参数，必须以 # 为开头多个参数使用"&"连接，参考上述地址为例使用参数。 禁用缓存url#noCache
 *
 *** 主要参数
 * [in=] 自动判断机场节点名类型 优先级 zh(中文) -> flag(国旗) -> quan(英文全称) -> en(英文简写)
 * 如果不准的情况, 可以加参数指定:
 *
 * [nm]    保留没有匹配到的节点
 * [in=zh] 或in=cn识别中文
 * [in=en] 或in=us 识别英文缩写
 * [in=flag] 或in=gq 识别国旗 如果加参数 in=flag 则识别国旗 脚本操作前面不要添加国旗操作 否则移除国旗后面脚本识别不到
 * [in=quan] 识别英文全称

 *
 * [out=]   输出节点名可选参数: (cn或zh ，us或en ，gq或flag ，quan) 对应：(中文，英文缩写 ，国旗 ，英文全称) 默认中文 例如 [out=en] 或 out=us 输出英文缩写
 *** 分隔符参数
 *
 * [fgf=]   节点名前缀或国旗分隔符，默认为空格；
 * [sn=]    设置国家与序号之间的分隔符，默认为空格；
 * 序号参数
 * [one]    清理只有一个节点的地区的01
 * [flag]   给节点前面加国旗
 *
 *** 前缀参数
 * [name=]  节点添加机场名称前缀；
 * [nf]     把 name= 的前缀值放在最前面
 *** 保留参数
 * [blkey=iplc+gpt+NF+IPLC] 用+号添加多个关键词 保留节点名的自定义字段 需要区分大小写!
 * 如果需要修改 保留的关键词 替换成别的 可以用 > 分割 例如 [#blkey=GPT>新名字+其他关键词] 这将把【GPT】替换成【新名字】
 * 例如      https://raw.githubusercontent.com/Keywos/rule/main/rename.js#flag&blkey=GPT>新名字+NF
 * [blgd]   保留: 家宽 IPLC ˣ² 等
 * [bl]     正则匹配保留 [0.1x, x0.2, 6x ,3倍]等标识
 * [nx]     保留1倍率与不显示倍率的
 * [blnx]   只保留高倍率
 * [clear]  清理乱名
 * [blpx]   如果用了上面的bl参数,对保留标识后的名称分组排序,如果没用上面的bl参数单独使用blpx则不起任何作用
 * [blockquic] blockquic=on 阻止; blockquic=off 不阻止
 *
 *** 机场标记参数 (在节点名后面追加来源机场, 例如: 🇺🇸 美国 (Amy))
 * [am=]    手动指定来源机场名称, 适合“按订阅单独处理”时使用, 例如 #flag&am=Amy 输出 🇺🇸 美国 (Amy)
 *          机场名称会用括号包裹追加到地区名之后; 留空则不追加。
 * [amap]   开启基于节点名的自动判断机场 (读取下方 airportMap 配置, 正则命中即判定)
 *          优先级: airportMap 正则命中 > am= 手动指定。两者都没命中则不追加机场标记。
 *          自定义机场配置见下方 airportMap (JSON 形式): key=机场显示名, value=匹配原始节点名的正则。
 *
 *** 家宽标记 (默认开启, 无需参数)
 *          原始节点名命中 家庭宽带|静态IP|家宽|住宅|ISP (不区分大小写) 时, 在机场标记里追加 -家宽
 *          例如: 🇸🇬 新加坡 (Amy-家宽) 01 ; 没有机场名时为 🇸🇬 新加坡 (家宽) 01
 *          关键词见下方 homeBroadbandRegex, 可按需增删
 */

// const inArg = {'blkey':'iplc+GPT>GPTnewName+NF+IPLC', 'flag':true };
const inArg = $arguments; // console.log(inArg)
// 参数容错: 适配 Sub-Store key-value 里 value 留空的情况
// 开关型 flagOn: 写了这个 key (value 可留空) 即视为开启; 仅显式 false/0/off/no 才关闭
const flagOn = (v) => {
  if (v === undefined) return false;
  const s = String(v).toLowerCase();
  return !(s === "false" || s === "0" || s === "off" || s === "no");
};
// 取值型 argVal: 未提供或留空("")则用默认值
const argVal = (v, def) => (v === undefined || v === "" ? def : decodeURI(v));
const nx = flagOn(inArg.nx),
  bl = flagOn(inArg.bl),
  nf = flagOn(inArg.nf),
  key = flagOn(inArg.key),
  blgd = flagOn(inArg.blgd),
  blpx = flagOn(inArg.blpx),
  blnx = flagOn(inArg.blnx),
  numone = flagOn(inArg.one),
  debug = flagOn(inArg.debug),
  clear = flagOn(inArg.clear),
  addflag = flagOn(inArg.flag),
  amap = flagOn(inArg.amap),
  nm = flagOn(inArg.nm);

// 机场标记: 手动指定的来源机场名称 (例如 #am=Amy)
const AMNAME = argVal(inArg.am, "");

const FGF = argVal(inArg.fgf, " "),
  XHFGF = argVal(inArg.sn, " "),
  FNAME = argVal(inArg.name, ""),
  BLKEY = argVal(inArg.blkey, ""),
  blockquic = argVal(inArg.blockquic, ""),
  nameMap = {
    cn: "cn",
    zh: "cn",
    us: "us",
    en: "us",
    quan: "quan",
    gq: "gq",
    flag: "gq",
  },
  inname = nameMap[inArg.in] || "",
  outputName = nameMap[inArg.out] || "";
// prettier-ignore
const FG = ['🇭🇰','🇲🇴','🇹🇼','🇯🇵','🇰🇷','🇸🇬','🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇦🇺','🇦🇪','🇦🇫','🇦🇱','🇩🇿','🇦🇴','🇦🇷','🇦🇲','🇦🇹','🇦🇿','🇧🇭','🇧🇩','🇧🇾','🇧🇪','🇧🇿','🇧🇯','🇧🇹','🇧🇴','🇧🇦','🇧🇼','🇧🇷','🇻🇬','🇧🇳','🇧🇬','🇧🇫','🇧🇮','🇰🇭','🇨🇲','🇨🇦','🇨🇻','🇰🇾','🇨🇫','🇹🇩','🇨🇱','🇨🇴','🇰🇲','🇨🇬','🇨🇩','🇨🇷','🇭🇷','🇨🇾','🇨🇿','🇩🇰','🇩🇯','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇬🇶','🇪🇷','🇪🇪','🇪🇹','🇫🇯','🇫🇮','🇬🇦','🇬🇲','🇬🇪','🇬🇭','🇬🇷','🇬🇱','🇬🇹','🇬🇳','🇬🇾','🇭🇹','🇭🇳','🇭🇺','🇮🇸','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪','🇮🇲','🇮🇱','🇮🇹','🇨🇮','🇯🇲','🇯🇴','🇰🇿','🇰🇪','🇰🇼','🇰🇬','🇱🇦','🇱🇻','🇱🇧','🇱🇸','🇱🇷','🇱🇾','🇱🇹','🇱🇺','🇲🇰','🇲🇬','🇲🇼','🇲🇾','🇲🇻','🇲🇱','🇲🇹','🇲🇷','🇲🇺','🇲🇽','🇲🇩','🇲🇨','🇲🇳','🇲🇪','🇲🇦','🇲🇿','🇲🇲','🇳🇦','🇳🇵','🇳🇱','🇳🇿','🇳🇮','🇳🇪','🇳🇬','🇰🇵','🇳🇴','🇴🇲','🇵🇰','🇵🇦','🇵🇾','🇵🇪','🇵🇭','🇵🇹','🇵🇷','🇶🇦','🇷🇴','🇷🇺','🇷🇼','🇸🇲','🇸🇦','🇸🇳','🇷🇸','🇸🇱','🇸🇰','🇸🇮','🇸🇴','🇿🇦','🇪🇸','🇱🇰','🇸🇩','🇸🇷','🇸🇿','🇸🇪','🇨🇭','🇸🇾','🇹🇯','🇹🇿','🇹🇭','🇹🇬','🇹🇴','🇹🇹','🇹🇳','🇹🇷','🇹🇲','🇻🇮','🇺🇬','🇺🇦','🇺🇾','🇺🇿','🇻🇪','🇻🇳','🇾🇪','🇿🇲','🇿🇼','🇦🇩','🇷🇪','🇵🇱','🇬🇺','🇻🇦','🇱🇮','🇨🇼','🇸🇨','🇦🇶','🇬🇮','🇨🇺','🇫🇴','🇦🇽','🇧🇲','🇹🇱']
// prettier-ignore
const EN = ['HK','MO','TW','JP','KR','SG','US','GB','FR','DE','AU','AE','AF','AL','DZ','AO','AR','AM','AT','AZ','BH','BD','BY','BE','BZ','BJ','BT','BO','BA','BW','BR','VG','BN','BG','BF','BI','KH','CM','CA','CV','KY','CF','TD','CL','CO','KM','CG','CD','CR','HR','CY','CZ','DK','DJ','DO','EC','EG','SV','GQ','ER','EE','ET','FJ','FI','GA','GM','GE','GH','GR','GL','GT','GN','GY','HT','HN','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','CI','JM','JO','KZ','KE','KW','KG','LA','LV','LB','LS','LR','LY','LT','LU','MK','MG','MW','MY','MV','ML','MT','MR','MU','MX','MD','MC','MN','ME','MA','MZ','MM','NA','NP','NL','NZ','NI','NE','NG','KP','NO','OM','PK','PA','PY','PE','PH','PT','PR','QA','RO','RU','RW','SM','SA','SN','RS','SL','SK','SI','SO','ZA','ES','LK','SD','SR','SZ','SE','CH','SY','TJ','TZ','TH','TG','TO','TT','TN','TR','TM','VI','UG','UA','UY','UZ','VE','VN','YE','ZM','ZW','AD','RE','PL','GU','VA','LI','CW','SC','AQ','GI','CU','FO','AX','BM','TL'];
// prettier-ignore
const ZH = ['香港','澳门','台湾','日本','韩国','新加坡','美国','英国','法国','德国','澳大利亚','阿联酋','阿富汗','阿尔巴尼亚','阿尔及利亚','安哥拉','阿根廷','亚美尼亚','奥地利','阿塞拜疆','巴林','孟加拉国','白俄罗斯','比利时','伯利兹','贝宁','不丹','玻利维亚','波斯尼亚和黑塞哥维那','博茨瓦纳','巴西','英属维京群岛','文莱','保加利亚','布基纳法索','布隆迪','柬埔寨','喀麦隆','加拿大','佛得角','开曼群岛','中非共和国','乍得','智利','哥伦比亚','科摩罗','刚果(布)','刚果(金)','哥斯达黎加','克罗地亚','塞浦路斯','捷克','丹麦','吉布提','多米尼加共和国','厄瓜多尔','埃及','萨尔瓦多','赤道几内亚','厄立特里亚','爱沙尼亚','埃塞俄比亚','斐济','芬兰','加蓬','冈比亚','格鲁吉亚','加纳','希腊','格陵兰','危地马拉','几内亚','圭亚那','海地','洪都拉斯','匈牙利','冰岛','印度','印尼','伊朗','伊拉克','爱尔兰','马恩岛','以色列','意大利','科特迪瓦','牙买加','约旦','哈萨克斯坦','肯尼亚','科威特','吉尔吉斯斯坦','老挝','拉脱维亚','黎巴嫩','莱索托','利比里亚','利比亚','立陶宛','卢森堡','马其顿','马达加斯加','马拉维','马来','马尔代夫','马里','马耳他','毛利塔尼亚','毛里求斯','墨西哥','摩尔多瓦','摩纳哥','蒙古','黑山共和国','摩洛哥','莫桑比克','缅甸','纳米比亚','尼泊尔','荷兰','新西兰','尼加拉瓜','尼日尔','尼日利亚','朝鲜','挪威','阿曼','巴基斯坦','巴拿马','巴拉圭','秘鲁','菲律宾','葡萄牙','波多黎各','卡塔尔','罗马尼亚','俄罗斯','卢旺达','圣马力诺','沙特阿拉伯','塞内加尔','塞尔维亚','塞拉利昂','斯洛伐克','斯洛文尼亚','索马里','南非','西班牙','斯里兰卡','苏丹','苏里南','斯威士兰','瑞典','瑞士','叙利亚','塔吉克斯坦','坦桑尼亚','泰国','多哥','汤加','特立尼达和多巴哥','突尼斯','土耳其','土库曼斯坦','美属维尔京群岛','乌干达','乌克兰','乌拉圭','乌兹别克斯坦','委内瑞拉','越南','也门','赞比亚','津巴布韦','安道尔','留尼汪','波兰','关岛','梵蒂冈','列支敦士登','库拉索','塞舌尔','南极','直布罗陀','古巴','法罗群岛','奥兰群岛','百慕达','东帝汶'];
// prettier-ignore
const QC = ['Hong Kong','Macao','Taiwan','Japan','Korea','Singapore','United States','United Kingdom','France','Germany','Australia','Dubai','Afghanistan','Albania','Algeria','Angola','Argentina','Armenia','Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','British Virgin Islands','Brunei','Bulgaria','Burkina-faso','Burundi','Cambodia','Cameroon','Canada','CapeVerde','CaymanIslands','Central African Republic','Chad','Chile','Colombia','Comoros','Congo-Brazzaville','Congo-Kinshasa','CostaRica','Croatia','Cyprus','Czech Republic','Denmark','Djibouti','Dominican Republic','Ecuador','Egypt','EISalvador','Equatorial Guinea','Eritrea','Estonia','Ethiopia','Fiji','Finland','Gabon','Gambia','Georgia','Ghana','Greece','Greenland','Guatemala','Guinea','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Isle of Man','Israel','Italy','Ivory Coast','Jamaica','Jordan','Kazakstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Lithuania','Luxembourg','Macedonia','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Mauritania','Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar(Burma)','Namibia','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','NorthKorea','Norway','Oman','Pakistan','Panama','Paraguay','Peru','Philippines','Portugal','PuertoRico','Qatar','Romania','Russia','Rwanda','SanMarino','SaudiArabia','Senegal','Serbia','SierraLeone','Slovakia','Slovenia','Somalia','SouthAfrica','Spain','SriLanka','Sudan','Suriname','Swaziland','Sweden','Switzerland','Syria','Tajikstan','Tanzania','Thailand','Togo','Tonga','TrinidadandTobago','Tunisia','Turkey','Turkmenistan','U.S.Virgin Islands','Uganda','Ukraine','Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe','Andorra','Reunion','Poland','Guam','Vatican','Liechtensteins','Curacao','Seychelles','Antarctica','Gibraltar','Cuba','Faroe Islands','Ahvenanmaa','Bermuda','Timor-Leste'];
const specialRegex = [
  /(\d\.)?\d+×/,
  /IPLC|IEPL|Kern|Edge|Pro|Std|Exp|Biz|Fam|Game|Buy|Zx|LB|Game/,
];
const nameclear =
  /(套餐|到期|有效|剩余|版本|已用|过期|失联|测试|官方|网址|备用|群|TEST|客服|网站|获取|订阅|流量|机场|下次|官址|联系|邮箱|工单|学术|USE|USED|TOTAL|EXPIRE|EMAIL)/i;
// prettier-ignore
const regexArray=[/ˣ²/, /ˣ³/, /ˣ⁴/, /ˣ⁵/, /ˣ⁶/, /ˣ⁷/, /ˣ⁸/, /ˣ⁹/, /ˣ¹⁰/, /ˣ²⁰/, /ˣ³⁰/, /ˣ⁴⁰/, /ˣ⁵⁰/, /IPLC/i, /IEPL/i, /核心/, /边缘/, /高级/, /标准/, /实验/, /商宽/, /家宽/, /游戏|game/i, /购物/, /专线/, /LB/, /cloudflare/i, /\budp\b/i, /\bgpt\b/i,/udpn\b/];
// prettier-ignore
const valueArray= [ "2×","3×","4×","5×","6×","7×","8×","9×","10×","20×","30×","40×","50×","IPLC","IEPL","Kern","Edge","Pro","Std","Exp","Biz","Fam","Game","Buy","Zx","LB","CF","UDP","GPT","UDPN"];
const nameblnx = /(高倍|(?!1)2+(x|倍)|ˣ²|ˣ³|ˣ⁴|ˣ⁵|ˣ¹⁰)/i;
const namenx = /(高倍|(?!1)(0\.|\d)+(x|倍)|ˣ²|ˣ³|ˣ⁴|ˣ⁵|ˣ¹⁰)/i;
const keya =
  /港|Hong|HK|新加坡|SG|Singapore|日本|Japan|JP|美国|United States|US|韩|土耳其|TR|Turkey|Korea|KR|🇸🇬|🇭🇰|🇯🇵|🇺🇸|🇰🇷|🇹🇷/i;
const keyb =
  /(((1|2|3|4)\d)|(香港|Hong|HK) 0[5-9]|((新加坡|SG|Singapore|日本|Japan|JP|美国|United States|US|韩|土耳其|TR|Turkey|Korea|KR) 0[3-9]))/i;
const rurekey = {
  GB: /UK/g,
  "B-G-P": /BGP/g,
  "Russia Moscow": /Moscow/g,
  "Korea Chuncheon": /Chuncheon|Seoul/g,
  "Hong Kong": /Hongkong|HONG KONG/gi,
  "United Kingdom London": /London|Great Britain/g,
  "Dubai United Arab Emirates": /United Arab Emirates/g,
  "Taiwan TW 台湾 🇹🇼": /(台|Tai\s?wan|TW).*?🇨🇳|🇨🇳.*?(台|Tai\s?wan|TW)/g,
  "United States": /USA|Los Angeles|San Jose|Silicon Valley|Michigan/g,
  澳大利亚: /澳洲|墨尔本|悉尼|土澳|(深|沪|呼|京|广|杭)澳/g,
  德国: /(深|沪|呼|京|广|杭)德(?!.*(I|线))|法兰克福|滬德/g,
  香港: /(深|沪|呼|京|广|杭)港(?!.*(I|线))/g,
  日本: /(深|沪|呼|京|广|杭|中|辽)日(?!.*(I|线))|东京|大坂/g,
  新加坡: /狮城|(深|沪|呼|京|广|杭)新/g,
  美国: /(深|沪|呼|京|广|杭)美|波特兰|芝加哥|哥伦布|纽约|硅谷|俄勒冈|西雅图|芝加哥/g,
  波斯尼亚和黑塞哥维那: /波黑共和国/g,
  印尼: /印度尼西亚|雅加达/g,
  印度: /孟买/g,
  阿联酋: /迪拜|阿拉伯联合酋长国/g,
  孟加拉国: /孟加拉/g,
  捷克: /捷克共和国/g,
  台湾: /新台|新北|台(?!.*线)/g,
  Taiwan: /Taipei/g,
  韩国: /春川|韩|首尔/g,
  Japan: /Tokyo|Osaka/g,
  英国: /伦敦/g,
  India: /Mumbai/g,
  Germany: /Frankfurt/g,
  Switzerland: /Zurich/g,
  俄罗斯: /莫斯科/g,
  土耳其: /伊斯坦布尔/g,
  泰国: /泰國|曼谷/g,
  法国: /巴黎/g,
  G: /\d\s?GB/gi,
  Esnc: /esnc/gi,
};

/**
 * 机场标记自定义配置 —— 自动判断来源机场, 在地区名后追加 (机场名)
 *   key   : 机场显示名 (会以括号形式追加到节点名末尾, 例如 (Amy))
 *   value : 正则字符串, 匹配“原始节点名”里的特征字符, 命中即判定为该机场 (默认忽略大小写)
 *   以 _ 或 // 开头的 key 视为注释, 会被忽略; 自上而下匹配, 命中第一个即停止。
 *
 * 配置来源 (优先级从高到低, 命中即作为完整配置):
 *   1) 参数 amjson=  原始 JSON 字符串, 适合复杂正则。例:
 *        amjson={"Amy":"Amy|艾米","八戒":"Gemini|bajie"}
 *   2) 参数 ammap=   紧凑写法, 多个机场用 ; 隔开, 机场名与正则用 > 隔开。例:
 *        ammap=八戒>IEPL|Gemini;蚯蚓>「;TAG>丨
 *      (正则里若需要用到 ; 或 > 字面量, 请改用 amjson=)
 *   3) 参数 amfile=  指定 json 路径 / 同目录 airport.json (仅 Node/自建后端有效)
 *   4) 下面这份内置默认 (App 内置沙箱兜底)
 *   传了 amjson= 或 ammap= 会自动开启自动判断, 无需再额外加 amap。
 * 提示: 若“按订阅单独处理”, 直接用参数 am=机场名 最省事 (不依赖节点名特征)。
 */
let airportRaw = {
  Amy: "Amy|AmyTelecom|艾米",
  八戒: "八戒|bajie|bmjsub|Gemini",
  // "机场显示名": "关键词1|关键词2",
};
try {
  const fs = require("fs"),
    path = require("path");
  const cfgPath =
    (inArg.amfile && decodeURI(inArg.amfile)) ||
    (typeof __dirname !== "undefined" && path.join(__dirname, "airport.json"));
  if (cfgPath && fs.existsSync(cfgPath)) {
    airportRaw = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  }
} catch (e) {
  /* 沙箱环境无 fs, 使用内置默认 */
}
// 参数注入配置 (内置沙箱推荐, 优先级高于本地文件; 传入即作为完整配置)
// ammap= 紧凑写法: 机场名>正则;机场名>正则
if (inArg.ammap) {
  const m = {};
  decodeURI(inArg.ammap)
    .split(";")
    .forEach((pair) => {
      const i = pair.indexOf(">");
      if (i > 0) m[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
    });
  if (Object.keys(m).length) airportRaw = m;
}
// amjson= 原始 JSON 字符串
if (inArg.amjson) {
  try {
    airportRaw = JSON.parse(decodeURI(inArg.amjson));
  } catch (e) {
    /* amjson 解析失败, 忽略 */
  }
}
const airportMap = {};
for (const k in airportRaw) {
  if (k.startsWith("_") || k.startsWith("//")) continue; // 注释键
  airportMap[k] =
    airportRaw[k] instanceof RegExp ? airportRaw[k] : new RegExp(airportRaw[k], "i");
}
// 是否开启“自动判断机场”: 显式 amap, 或传了 ammap=/amjson= 即视为开启
const amAuto = !!(amap || inArg.ammap || inArg.amjson);

// 家宽标记: 原始节点名命中以下关键词即视为家宽节点, 在机场标记里追加 -家宽
const homeBroadbandRegex = /家庭宽带|静态IP|家宽|住宅|ISP/i;
const HB_TAG = "家宽";

let GetK = false, AMK = []
function ObjKA(i) {
  GetK = true
  AMK = Object.entries(i)
}

function operator(pro) {
  const Allmap = {};
  const outList = getList(outputName);
  let inputList,
    retainKey = "";
  if (inname !== "") {
    inputList = [getList(inname)];
  } else {
    inputList = [ZH, FG, QC, EN];
  }

  inputList.forEach((arr) => {
    arr.forEach((value, valueIndex) => {
      Allmap[value] = outList[valueIndex];
    });
  });

  if (clear || nx || blnx || key) {
    pro = pro.filter((res) => {
      const resname = res.name;
      const shouldKeep =
        !(clear && nameclear.test(resname)) &&
        !(nx && namenx.test(resname)) &&
        !(blnx && !nameblnx.test(resname)) &&
        !(key && !(keya.test(resname) && /2|4|6|7/i.test(resname)));
      return shouldKeep;
    });
  }

  const BLKEYS = BLKEY ? BLKEY.split("+") : "";

  pro.forEach((e) => {
    let bktf = false, ens = e.name
    // 机场标记: 基于“原始节点名 ens”判断来源机场, 命中第一个即停止
    // 优先级: airportMap 正则命中 > am= 手动指定
    let amName = AMNAME;
    if (amAuto) {
      for (const apName in airportMap) {
        if (airportMap[apName].test(ens)) {
          amName = apName;
          break;
        }
      }
    }
    // 家宽节点: (机场名-家宽), 没有机场名时为 (家宽)
    const isHB = homeBroadbandRegex.test(ens);
    const tagText = [amName, isHB ? HB_TAG : ""].filter((t) => t !== "").join("-");
    const amTag = tagText ? `(${tagText})` : "";
    // 预处理 防止预判或遗漏
    Object.keys(rurekey).forEach((ikey) => {
      if (rurekey[ikey].test(e.name)) {
        e.name = e.name.replace(rurekey[ikey], ikey);
      if (BLKEY) {
        bktf = true
        let BLKEY_REPLACE = "",
        re = false;
      BLKEYS.forEach((i) => {
        if (i.includes(">") && ens.includes(i.split(">")[0])) {
          if (rurekey[ikey].test(i.split(">")[0])) {
              e.name += " " + i.split(">")[0]
            }
          if (i.split(">")[1]) {
            BLKEY_REPLACE = i.split(">")[1];
            re = true;
          }
        } else {
          if (ens.includes(i)) {
             e.name += " " + i
            }
        }
        retainKey = re
        ? BLKEY_REPLACE
        : BLKEYS.filter((items) => e.name.includes(items));
      });}
      }
    });
    if (blockquic == "on") {
      e["block-quic"] = "on";
    } else if (blockquic == "off") {
      e["block-quic"] = "off";
    } else {
      delete e["block-quic"];
    }

    // 自定义
    if (!bktf && BLKEY) {
      let BLKEY_REPLACE = "",
        re = false;
      BLKEYS.forEach((i) => {
        if (i.includes(">") && e.name.includes(i.split(">")[0])) {
          if (i.split(">")[1]) {
            BLKEY_REPLACE = i.split(">")[1];
            re = true;
          }
        }
      });
      retainKey = re
        ? BLKEY_REPLACE
        : BLKEYS.filter((items) => e.name.includes(items));
    }

    let ikey = "",
      ikeys = "";
    // 保留固定格式 倍率
    if (blgd) {
      regexArray.forEach((regex, index) => {
        if (regex.test(e.name)) {
          ikeys = valueArray[index];
        }
      });
    }

    // 正则 匹配倍率
    if (bl) {
      const match = e.name.match(
        /((倍率|X|x|×)\D?((\d{1,3}\.)?\d+)\D?)|((\d{1,3}\.)?\d+)(倍|X|x|×)/
      );
      if (match) {
        const rev = match[0].match(/(\d[\d.]*)/)[0];
        if (rev !== "1") {
          const newValue = rev + "×";
          ikey = newValue;
        }
      }
    }

    !GetK && ObjKA(Allmap)
    // 匹配 Allkey 地区
    const findKey = AMK.find(([key]) =>
      e.name.includes(key)
    )
    
    let firstName = "",
      nNames = "";

    if (nf) {
      firstName = FNAME;
    } else {
      nNames = FNAME;
    }
    if (findKey?.[1]) {
      const findKeyValue = findKey[1];
      let keyover = [],
        usflag = "";
      if (addflag) {
        const index = outList.indexOf(findKeyValue);
        if (index !== -1) {
          usflag = FG[index];
          usflag = usflag === "🇹🇼" ? "🇨🇳" : usflag;
        }
      }
      keyover = keyover
        .concat(firstName, usflag, nNames, findKeyValue, retainKey, ikey, ikeys, amTag)
        .filter((k) => k !== "");
      e.name = keyover.join(FGF);
    } else {
      if (nm) {
        e.name = FNAME + FGF + e.name + (amTag ? FGF + amTag : "");
      } else {
        e.name = null;
      }
    }
  });
  pro = pro.filter((e) => e.name !== null);
  jxh(pro);
  numone && oneP(pro);
  blpx && (pro = fampx(pro));
  key && (pro = pro.filter((e) => !keyb.test(e.name)));
  return pro;
}

// prettier-ignore
function getList(arg) { switch (arg) { case 'us': return EN; case 'gq': return FG; case 'quan': return QC; default: return ZH; }}
// prettier-ignore
function jxh(e) { const n = e.reduce((e, n) => { const t = e.find((e) => e.name === n.name); if (t) { t.count++; t.items.push({ ...n, name: `${n.name}${XHFGF}${t.count.toString().padStart(2, "0")}`, }); } else { e.push({ name: n.name, count: 1, items: [{ ...n, name: `${n.name}${XHFGF}01` }], }); } return e; }, []);const t=(typeof Array.prototype.flatMap==='function'?n.flatMap((e) => e.items):n.reduce((acc, e) => acc.concat(e.items),[])); e.splice(0, e.length, ...t); return e;}
// prettier-ignore
function oneP(e) { const t = e.reduce((e, t) => { const n = t.name.replace(/[^A-Za-z0-9\u00C0-\u017F\u4E00-\u9FFF]+\d+$/, ""); if (!e[n]) { e[n] = []; } e[n].push(t); return e; }, {}); for (const e in t) { if (t[e].length === 1 && t[e][0].name.endsWith("01")) {/* const n = t[e][0]; n.name = e;*/ t[e][0].name= t[e][0].name.replace(/[^.]01/, "") } } return e; }
// prettier-ignore
function fampx(pro) { const wis = []; const wnout = []; for (const proxy of pro) { const fan = specialRegex.some((regex) => regex.test(proxy.name)); if (fan) { wis.push(proxy); } else { wnout.push(proxy); } } const sps = wis.map((proxy) => specialRegex.findIndex((regex) => regex.test(proxy.name)) ); wis.sort( (a, b) => sps[wis.indexOf(a)] - sps[wis.indexOf(b)] || a.name.localeCompare(b.name) ); wnout.sort((a, b) => pro.indexOf(a) - pro.indexOf(b)); return wnout.concat(wis);}