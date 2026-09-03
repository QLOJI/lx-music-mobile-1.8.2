import { LIST_IDS } from '@/config/constant'
import { overwriteListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import listAction from '@/store/list/action'
import listState from '@/store/list/state'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { getListMusicSync } from '@/utils/listManage'


/**
 * 把一个在线源列表整体写入「试听列表(DEFAULT)」并从指定位置开始播放。
 * 用于 排行榜/歌单/搜索 页面的点歌播放（整份并入试听列表队列）：
 * - 开启「自动清空已播放列表」：每次都整体重写（先清空再按序写入）；
 * - 关闭：仅当 当前播放列表不是试听列表 / 换到另一份源列表 / 内容已变化 /
 *   DEFAULT 比目标列表短（列表随懒加载变长） 时才整体替换；
 *   同一份列表内切歌、或 DEFAULT 已被全量拉取扩列时（比当前加载子集更长）不重复写入、也不截断。
 * 复用 listState.tempListMeta 记录「试听列表当前映射到哪份源列表」（仅运行态标记）。
 */
export const stageOnlineListToDefault = async(stagedListId: string, list: LX.Music.MusicInfoOnline[], index: number, force = false) => {
  const isAutoClean = settingState.setting['player.isAutoCleanPlayedList']
  const curList = getListMusicSync(LIST_IDS.DEFAULT)
  const curLen = curList.length
  const sameSourceLoaded = playerState.playInfo.playerListId == LIST_IDS.DEFAULT
    && listState.tempListMeta.id == stagedListId
  // 试听列表当前内容与要并入的这份源列表开头一致（来自同一份列表）
  const curFirstId = curList[0]?.id
  const listFirstId = list[0]?.id
  const firstIdSame = curFirstId != null && curFirstId == listFirstId

  const needRewrite = force
    || isAutoClean
    || !sameSourceLoaded
    || !firstIdSame
    || curLen < list.length
  if (needRewrite) {
    await overwriteListMusics(LIST_IDS.DEFAULT, list)
    listAction.setTempListMeta({ id: stagedListId })
  }
  await playList(LIST_IDS.DEFAULT, index)
}

/**
 * 源列表全量（如排行榜/歌单详情）拉取完成后刷新试听列表内容。
 * 保持当前播放位不变（仍在播放的歌曲序号不变），仅把列扩容为完整列表。
 */
export const refreshDefaultList = async(list: LX.Music.MusicInfo[]) => {
  await overwriteListMusics(LIST_IDS.DEFAULT, list)
}
