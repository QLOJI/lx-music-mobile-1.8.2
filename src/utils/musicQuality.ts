// 音质小标（列表行右侧/源徽标内）的统一命名。
// 全仓只有两处列表行在渲染音质小标：
//   src/components/OnlineList/ListItem.tsx（搜索/排行榜/歌单共用行）
//   src/screens/Home/Views/Mylist/MusicList/ListItem.tsx（我的列表）
// 都走本文件的 getQualityTagInfo，保证文案永远一致。

// “无损及以上”伞：任何一档存在，TX/KG/WY 曲目顶级即按 Master 显示，
// 取流降级链（master→atmos→flac24bit→flac→320k→128k）与合成 master 注入共用此概念。
export const MASTER_UMBRELLA_QUALITIES: LX.Quality[] = ['master', 'atmosplus', 'atmos', 'flac24bit', 'flac', 'wav', 'ape']

type Qualitys = LX.Music._MusicQualityType | LX.Music._MusicQualityTypeKg | undefined

// kw/mg 及未单独处理的源（百度等）保持原有文案：master/无损类为 premium，320k 为普通；
// 顶级仅 192k/128k 的曲目补齐 192K/128K 小标，保证任何有可用档的在线曲目都有小标
const legacyQualityTag = (qualitys: Qualitys, t: (key: string) => string): { text: string, premium: boolean } => {
  if (!qualitys) return { text: '', premium: false }
  if (qualitys.master) return { text: 'Master', premium: true }
  if (qualitys.atmosplus) return { text: 'atmosplus', premium: true }
  if (qualitys.atmos) return { text: 'atmos', premium: true }
  if (qualitys.flac24bit) return { text: t('quality_lossless_24bit'), premium: true }
  if (qualitys.flac || qualitys.ape || qualitys.wav) return { text: t('quality_lossless'), premium: true }
  if (qualitys['320k']) return { text: t('quality_high_quality'), premium: false }
  if (qualitys['192k']) return { text: '192K', premium: false }
  if (qualitys['128k']) return { text: '128K', premium: false }
  return { text: '', premium: false }
}

export const getQualityTagInfo = (musicInfo: { source: LX.Source, meta: { _qualitys?: LX.Music._MusicQualityType | LX.Music._MusicQualityTypeKg } }, t: (key: string) => string): { text: string, premium: boolean } => {
  const source = musicInfo.source
  if (source == 'local') return { text: '', premium: false }
  const qualitys = musicInfo.meta?._qualitys
  if (!qualitys) return { text: '', premium: false }

  // TX(QQ)/KG(酷狗)/WY(网易)：顶级属“无损及以上伞”→ Master；否则按 320k→HQ、192k→192K、128k→128K
  if (source == 'tx' || source == 'kg' || source == 'wy') {
    if (MASTER_UMBRELLA_QUALITIES.some(q => qualitys[q])) return { text: 'Master', premium: true }
    if (qualitys['320k']) return { text: t('quality_high_quality'), premium: false }
    if (qualitys['192k']) return { text: '192K', premium: false }
    if (qualitys['128k']) return { text: '128K', premium: false }
    return { text: '', premium: false }
  }

  return legacyQualityTag(qualitys, t)
}
