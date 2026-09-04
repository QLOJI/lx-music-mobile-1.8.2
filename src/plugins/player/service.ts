/* eslint-disable @typescript-eslint/no-misused-promises */
import TrackPlayer, { Event as TPEvent } from 'react-native-track-player'
import { AppState, Platform } from 'react-native'
import { pause, play, playNext, playPrev } from '@/core/player/player'
import { markTimeoutExitInteraction } from '@/core/player/timeoutExit'
import { initUnifiedPlayerController } from './controller'
import { exitApp } from '@/core/common'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'

let isInitialized = false
let shouldResumeAfterDuck = false
let duckRecoveryTimeouts: Array<ReturnType<typeof setTimeout>> = []

const clearDuckRecoveryTimeouts = () => {
  for (const timeout of duckRecoveryTimeouts) clearTimeout(timeout)
  duckRecoveryTimeouts = []
}

const restoreConfiguredVolume = () => {
  clearDuckRecoveryTimeouts()

  const applyVolume = () => {
    void TrackPlayer.setVolume(settingState.setting['player.volume']).catch(() => {})
  }

  applyVolume()
  duckRecoveryTimeouts = [250, 1000].map(delay => setTimeout(applyVolume, delay))
}

const registerPlaybackService = async() => {
  if (isInitialized) return

  console.log('reg services...')
  initUnifiedPlayerController()
  TrackPlayer.addEventListener(TPEvent.RemotePlay, () => {
    // console.log('remote-play')
    // 用户手动(锁屏/通知栏/耳机)要求播放：取消“被抢占后自动续播”的待恢复标记，直接播放
    shouldResumeAfterDuck = false
    markTimeoutExitInteraction()
    play()
  })

  TrackPlayer.addEventListener(TPEvent.RemotePause, () => {
    // console.log('remote-pause')
    // 用户手动要求暂停：清除自动续播标记，避免之后被兜底逻辑误自动播放
    shouldResumeAfterDuck = false
    markTimeoutExitInteraction()
    void pause()
  })

  TrackPlayer.addEventListener(TPEvent.RemoteNext, () => {
    // console.log('remote-next')
    markTimeoutExitInteraction()
    void playNext()
  })

  TrackPlayer.addEventListener(TPEvent.RemotePrevious, () => {
    // console.log('remote-previous')
    markTimeoutExitInteraction()
    void playPrev()
  })

  TrackPlayer.addEventListener(TPEvent.RemoteStop, () => {
    // console.log('remote-stop')
    shouldResumeAfterDuck = false
    clearDuckRecoveryTimeouts()
    global.lx.isPlayedStop = false
    exitApp('Remote Stop')
  })

  TrackPlayer.addEventListener(TPEvent.RemoteDuck, ({ permanent, paused, ducking }) => {
    // On iOS, interruptions surface through RemoteDuck and we need to explicitly
    // restore playback/volume after the system finishes ducking or pausing audio.
    if (permanent) {
      // Android 永久失去焦点(其它App持续出声)不自动抢回；
      // iOS 无 Android 的“永久/临时”区分，来电、它App出声、持续占用都表现为可恢复的中断，
      // 暂停前若在播放则记为“待自动续播”，等系统结束中断后再恢复
      shouldResumeAfterDuck = Platform.OS == 'ios' ? playerState.isPlay : false
      clearDuckRecoveryTimeouts()
      if (paused) void pause()
      return
    }

    if (ducking) {
      shouldResumeAfterDuck ||= playerState.isPlay
      clearDuckRecoveryTimeouts()
      return
    }

    if (paused) {
      shouldResumeAfterDuck = playerState.isPlay
      clearDuckRecoveryTimeouts()
      void pause()
      return
    }

    if (Platform.OS == 'ios' || ducking === false) restoreConfiguredVolume()

    if (shouldResumeAfterDuck) {
      shouldResumeAfterDuck = false
      play()
    }
  })

  TrackPlayer.addEventListener(TPEvent.RemoteSeek, async({ position }) => {
    markTimeoutExitInteraction()
    global.app_event.setProgress(position as number)
  })
  isInitialized = true
}


export default () => {
  if (global.lx.playerStatus.isRegisteredService) return
  console.log('handle registerPlaybackService...')
  TrackPlayer.registerPlaybackService(() => registerPlaybackService)
  global.lx.playerStatus.isRegisteredService = true

  // —— iOS：被其它软件出声抢占、自动暂停后的“自动续播”兜底 ——
  // RemoteDuck 的“中断结束”事件若在后台挂起期间没能送达 JS，回到前台时补一次续播。
  // 仅当“暂停前正在播放且尚未恢复”(shouldResumeAfterDuck) 才自动开始；
  // 用户手动暂停(RemotePause)或已真正开始播放都会清除该标记，不会误自动播放。
  AppState.addEventListener('change', (state) => {
    if (state != 'active') return
    if (global.lx.isPlayedStop || !shouldResumeAfterDuck || playerState.isPlay) return
    shouldResumeAfterDuck = false
    play()
  })
  // 一旦进入播放(任意途径触发)，清除待续播标记，避免后续重复自动播放
  global.app_event.on('play', () => {
    shouldResumeAfterDuck = false
  })
}
