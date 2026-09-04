import { createList } from '@/core/list'
import { refreshDefaultList, stageOnlineListToDefault } from '@/core/playListToDefault'
import { getListDetail, getListDetailAll } from '@/core/songlist'
import listState from '@/store/list/state'
import syncSourceList from '@/core/syncSourceList'
import { confirmDialog, toMD5, toast } from '@/utils/tools'
import { type Source } from '@/store/songlist/state'

const getListId = (id: string, source: LX.OnlineSource) => `${source}__${id}`

export const handlePlay = async(id: string, source: Source, list?: LX.Music.MusicInfoOnline[], index = 0) => {
  const listId = getListId(id, source)
  // console.log(list)
  if (!list?.length) list = (await getListDetail(id, source, 1)).list
  if (list?.length) {
    // 先把点击歌曲所在的歌单（当前已加载部分）并入试听列表顶部并开始播放
    await stageOnlineListToDefault(listId, [...list], index)
  }
  const fullList = await getListDetailAll(source, id)
  if (!fullList.length) return
  // 全量拉取完成后原位扩容顶部这一段（若期间已切到其它列表则自动跳过）
  await refreshDefaultList(listId, [...fullList])
}

export const handleCollect = async(id: string, source: Source, name: string) => {
  const listId = getListId(id, source)

  const targetList = listState.userList.find(l => l.sourceListId == listId)
  if (targetList) {
    const confirm = await confirmDialog({
      message: global.i18n.t('duplicate_list_tip', { name: targetList.name }),
      cancelButtonText: global.i18n.t('list_import_part_button_cancel'),
      confirmButtonText: global.i18n.t('confirm_button_text'),
    })
    if (!confirm) return
    void syncSourceList(targetList)
    return
  }

  const list = await getListDetailAll(source, id)
  await createList({
    name,
    id: `${source}_${toMD5(listId)}`,
    list,
    source,
    sourceListId: id,
  })
  toast(global.i18n.t('collect_success'))
}
