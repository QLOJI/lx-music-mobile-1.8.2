import { LIST_IDS } from '@/config/constant'
import { overwriteListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import settingState from '@/store/setting/state'
import { getListMusicSync } from '@/utils/listManage'


// 运行态记录：试听列表(DEFAULT)「顶部这一段」当前对应哪份源列表、长度多少。
// 用途：
// - 同一份源列表内切歌 → 不重复写入，仅在已置顶的那一段里切换播放；
// - 同一份源列表在线端加载变长（或全量拉取完成）→ 只原位扩容顶部这一段；
// - 切到另一份源列表 → 新列表整份按顺序置顶，旧内容保留在其下（不清空）。
// （仅运行期标记，不参与持久化；临时列表(TEMP)机制不受影响，搜索/歌单/排行榜不再使用它。）
let topSourceId = ''
let topSourceLen = 0

const isListPrefix = (prefix: LX.Music.MusicInfo[], list: LX.Music.MusicInfo[]) => {
  if (prefix.length > list.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i].id != list[i].id) return false
  }
  return true
}

/**
 * 把点击播放歌曲所在的在线源列表并入「试听列表(DEFAULT)」并从所选位置开始播放。
 * 搜索/排行榜/歌单详情页的点歌统一走这里（不使用临时列表）。
 * - 勾选「自动清空已播放列表」：每次都先清空试听列表，再整体写入这份列表；
 * - 未勾选：不清空，试听列表顶部已是这份列表时仅切换播放；
 *   否则把这份列表整份按歌单顺序置于试听列表顶部，原有内容保留在下。
 */
export const stageOnlineListToDefault = async(stagedListId: string, list: LX.Music.MusicInfoOnline[], index: number, force = false) => {
  const isAutoClean = settingState.setting['player.isAutoCleanPlayedList']
  const curList = getListMusicSync(LIST_IDS.DEFAULT)
  let newList: LX.Music.MusicInfo[]

  if (isAutoClean || force) {
    // 勾选「自动清空已播放列表」（或强制）：整体覆盖，旧内容丢弃
    newList = [...list]
  } else if (topSourceId == stagedListId) {
    if (isListPrefix(list, curList)) {
      // 该列表（或它靠前的部分）已经在顶部 → 不重复添加，仅切换播放
      await playList(LIST_IDS.DEFAULT, index)
      return
    }
    // 在线列表加载变长 / 内容刷新：只原位替换顶部这一段，保留其下旧内容
    const below = curList.slice(topSourceLen)
    newList = [...list, ...below]
  } else {
    // 换到一份新的源列表：不清空，把新列表整份按顺序置于旧内容顶部
    newList = [...list, ...curList]
  }

  await overwriteListMusics(LIST_IDS.DEFAULT, newList)
  topSourceId = stagedListId
  topSourceLen = list.length
  await playList(LIST_IDS.DEFAULT, index)
}

/**
 * 源列表全量（排行榜/歌单详情）拉取完成后，原位扩容试听列表顶部这一段。
 * 保持其下更早加入的旧内容不变；若当前顶部已不是这份列表则跳过，避免误覆盖。
 */
export const refreshDefaultList = async(stagedListId: string, list: LX.Music.MusicInfo[]) => {
  if (topSourceId != stagedListId) return
  const curList = getListMusicSync(LIST_IDS.DEFAULT)
  const below = curList.slice(topSourceLen)
  await overwriteListMusics(LIST_IDS.DEFAULT, [...list, ...below])
  topSourceLen = list.length
}
