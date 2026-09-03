import { memo, useMemo } from 'react'

import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { TRY_QUALITYS_LIST } from '@/core/music/utils'

const QUALITY_LABELS: Partial<Record<LX.Quality, string>> = {
  '128k': '128K',
  '320k': '320K',
  flac: 'Flac',
  flac24bit: 'Flac24bit',
  atmos: 'Atmos',
  master: 'Master',
}

const useActive = (id: LX.Quality) => {
  const q = useSettingValue('player.playQuality')
  const isActive = useMemo(() => q == id, [q, id])
  return isActive
}

const Item = ({ id }: {
  id: LX.Quality
}) => {
  const isActive = useActive(id)
  // const [toggleCheckBox, setToggleCheckBox] = useState(false)
  return <CheckBox marginBottom={6} check={isActive} label={QUALITY_LABELS[id] ?? id} onChange={() => { updateSetting({ 'player.playQuality': id }) }} need />
}

export default memo(() => {
  const t = useI18n()
  const playQualityList = useMemo(() => {
    return [...TRY_QUALITYS_LIST, '128k'].reverse() as LX.Quality[]
  }, [])

  return (
    <SubTitle title={t('setting_play_play_quality')}>
      <View style={styles.list}>
        {
          playQualityList.map((q) => <Item id={q} key={q} />)
        }
      </View>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  list: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
})


// export default memo(() => {
//   const t = useI18n()
//   const isPlayHighQuality = useSettingValue('player.isPlayHighQuality')
//   const setPlayHighQuality = (isPlayHighQuality: boolean) => {
//     updateSetting({ 'player.isPlayHighQuality': isPlayHighQuality })
//   }

//   return (
//     <View style={styles.content}>
//       <CheckBoxItem check={isPlayHighQuality} onChange={setPlayHighQuality} label={t('setting_play_quality')} />
//     </View>
//   )
// })


// const styles = createStyle({
//   content: {
//     marginTop: 5,
//   },
// })

