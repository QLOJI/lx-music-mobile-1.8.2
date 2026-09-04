import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { type NativeScrollEvent, type NativeSyntheticEvent, type LayoutChangeEvent, View, TouchableOpacity, Animated } from 'react-native'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { type Lines } from 'lrc-file-parser'
import { useTheme } from '@/store/theme/hook'
import { formatPlayTime2 } from '@/utils'
import { Icon } from '@/components/common/Icon'


export interface PlayLineType {
  updateScrollInfo: (scrollInfo: NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'] | null) => void
  updateLayoutInfo: (listLayoutInfo: { spaceHeight: number, lineHeights: number[] }) => void
  updateLyricLines: (lyricLines: Lines) => void
  setVisible: (visible: boolean) => void
}

export interface PlayLineProps {
  onPlayLine: (time: number) => void
}

const ANIMATION_DURATION = 300

// 虚线小段与间距：更短、间距更小 → 虚线更细、更密集
const DASH_LEN = 3
const DASH_GAP = 2
const DASH_HEIGHT = 1
// .line(虚线)是 flex:1，其后是播放三角按钮；虚线的右端距容器右缘 = 行间距 + 按钮宽
const ROW_GAP = 5
const LABEL_RIGHT_FALLBACK = 45
// 由左(浅)→右(深)渐变的不透明度区间；最深也不超过右侧播放三角(c-button-font≈0.9)，
// 且整体明显比原先统一 0.7 更淡
const DASH_ALPHA_MIN = 0.15
const DASH_ALPHA_MAX = 0.5

// 解析主题主色为 rgb 分量（兼容 rgb()/rgba()/hex），用于按透明度生成渐变
const parseRgb = (color: string): { r: number, g: number, b: number } | null => {
  if (!color) return null
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (m) return { r: +m[1], g: +m[2], b: +m[3] }
  const hex = color.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const n = parseInt(hex, 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
  }
  return null
}

export default forwardRef<PlayLineType, PlayLineProps>(({ onPlayLine }, ref) => {
  const theme = useTheme()
  const [scrollInfo, setScrollInfo] = useState<NativeSyntheticEvent<NativeScrollEvent>['nativeEvent'] | null>(null)
  const [listLayoutInfo, setListLayoutInfo] = useState<{ spaceHeight: number, lineHeights: number[] }>({ spaceHeight: 0, lineHeights: [] })
  const [lyricLines, setLyricLines] = useState<Lines>([])
  const [visible, setVisible] = useState(false)
  const [dashWidth, setDashWidth] = useState(0)
  const [buttonWidth, setButtonWidth] = useState(0)
  const opsAnim = useRef<Animated.Value>(
    new Animated.Value(0),
  ).current

  const setShow = (visible: boolean) => {
    Animated.timing(opsAnim, {
      toValue: visible ? 1 : 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: true,
    }).start(() => {
      if (!visible) setVisible(false)
    })
  }

  useImperativeHandle(ref, () => ({
    updateScrollInfo(scrollInfo) {
      setScrollInfo(scrollInfo)
    },
    updateLayoutInfo(listLayoutInfo) {
      setListLayoutInfo(listLayoutInfo)
    },
    updateLyricLines(lyricLines) {
      setLyricLines(lyricLines)
    },
    setVisible(visible) {
      if (visible) {
        setVisible(true)
      }
      requestAnimationFrame(() => {
        setShow(visible)
      })
      // setVisible()
    },
  }))

  const handlePlayLine = () => {
    onPlayLine(time / 1000)
  }

  const handleLineLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width
    setDashWidth((prevWidth: number) => (prevWidth == width ? prevWidth : width))
  }

  const handleButtonLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width
    setButtonWidth((prevWidth: number) => (prevWidth == width ? prevWidth : width))
  }

  if (!scrollInfo || !visible) return null
  const offset = scrollInfo.contentOffset.y + scrollInfo.layoutMeasurement.height * 0.4
  let lineOffset = listLayoutInfo.spaceHeight
  let targetLineNum = -1
  for (let line = 0; line < listLayoutInfo.lineHeights.length; line++) {
    lineOffset += listLayoutInfo.lineHeights[line]
    if (lineOffset < offset) continue
    targetLineNum = line
    break
  }
  if (targetLineNum == -1) targetLineNum = listLayoutInfo.lineHeights.length - 1
  const time = lyricLines[targetLineNum]?.time ?? 0
  const timeLabel = formatPlayTime2(time / 1000)

  // 渐变颜色：左侧浅 → 右侧深，均由主题主色派生
  const rgb = parseRgb(theme['c-primary'] || theme['c-primary-alpha-300']) ?? { r: 255, g: 255, b: 255 }
  const dashCount = dashWidth > 0 ? Math.floor((dashWidth + DASH_GAP) / (DASH_LEN + DASH_GAP)) : 0
  const getDashColor = (index: number) => {
    const ratio = dashCount > 1 ? index / (dashCount - 1) : 1
    const alpha = (DASH_ALPHA_MIN + (DASH_ALPHA_MAX - DASH_ALPHA_MIN) * ratio).toFixed(2)
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
  }
  // 时间文本右对齐虚线的右端：虚线右端距容器右缘 = 行间距 + 播放按钮宽度
  const labelRight = buttonWidth > 0 ? buttonWidth + ROW_GAP : LABEL_RIGHT_FALLBACK

  return (
    <Animated.View style={{ ...styles.playLine, opacity: opsAnim }}>
      <View style={styles.lineContent}>
        <View style={styles.line} onLayout={handleLineLayout}>
          {
            dashCount > 0
              ? Array.from({ length: dashCount }, (_, index) => (
                <View key={index} style={{ ...styles.dash, backgroundColor: getDashColor(index) }} />
              ))
              : null
          }
        </View>
        <View pointerEvents="none" style={{ ...styles.label, right: labelRight }}>
          <Text color={theme['c-primary-font']} size={13}>{timeLabel}</Text>
        </View>
        <TouchableOpacity style={styles.button} onLayout={handleButtonLayout} onPress={handlePlayLine}>
          <Icon name="play" color={theme['c-button-font']} size={18} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
})

const styles = createStyle({
  playLine: {
    position: 'absolute',
    width: '100%',
    top: '40%',
    left: 0,
    height: 2,
    // paddingTop: 5,
    // paddingBottom: 5,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  lineContent: {
    // backgroundColor: 'rgba(0,0,0,0.1)',
    position: 'absolute',
    width: '100%',
    // 高度加高，使时间文本能整体浮在虚线之上（虚线仍居中于 40% 拖拽线）
    height: 34,
    top: -17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
  },
  line: {
    marginLeft: 30,
    // iOS 对 1px 高度的 dashed 边框渲染不可靠（不可见），
    // 这里改为由若干个细短的小色块（dash）自行拼出虚线，保证可见
    height: DASH_HEIGHT,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  dash: {
    width: DASH_LEN,
    height: DASH_HEIGHT,
    marginRight: DASH_GAP,
  },
  label: {
    position: 'absolute',
    // 时间文本浮在虚线之上并基本贴线：只锚定底部（距容器底 16），右对齐由外层动态 right 控制。
    // 数字行盒下方约含 2-3px 空白(descender)，故文字实际下缘与虚线的间距 ≈ 虚线点间距(2px)
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    flex: 0,
    paddingLeft: 5,
    paddingRight: 15,
  },
})
