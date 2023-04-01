const fs = require('fs')

// 斗鱼加密函数的源码
const douyu_encrypt = require('./douyu_source_script')
const axios = require('axios')

const re = /\/([^/]*)$/

const videoUrl = process.argv[2]

if (!videoUrl || !re.test(videoUrl)) {
    console.error("请输入有效的视频地址")
    return
}

const videoId = videoUrl.match(re)[1]

async function requestPointId() {

    const response = await axios.get(videoUrl)

    const reg = new RegExp(`{"vid":"${videoId}","point_id":(\\d+)`)

    return response.data.toString().match(reg)[1]
}

async function parseParams(videoId) {
    // 第一个参数: pointId
    const pointId = await requestPointId()

    // 第二个参数: 固定值 '10000000000000000000000000001501'
    const did = '10000000000000000000000000001501'

    // 第三个参数: 时间戳 parseInt((new Date).getTime() / 1e3, 10)
    const s = parseInt((new Date).getTime() / 1e3, 10)

    // 加密后的字符串参数
    const p = douyu_encrypt(pointId, did, s)

    // 最终参数
    const t = `${p}&vid=${videoId}`

    return t
}

async function getStreamUrls(data) {
    const response = await axios({
        method: "POST",
        data,
        url: "https://v.douyu.com/api/stream/getStreamUrl"
    })

    const thumbVideo = response.data.data.thumb_video

    return {
        'high': thumbVideo.high.url,
        'normal': thumbVideo.normal.url,
        'super': thumbVideo.super.url,
    }
}

async function downloadM3U8(streamUrl, tag, videoId) {
    if (!streamUrl) {
        return
    }
    const response = await axios({
        method: "get",
        url: streamUrl
    })

    const lines = response.data.split("\n")

    let data = ''

    lines.forEach(line => {
        if (line.startsWith("transcode_live-")) {
            // .ts相对路径转绝对路径
            data += new URL(line, streamUrl)
        } else {
            data += line
        }
        data += "\n"
    })

    const localPath = `${videoId}-${tag}-playlist.m3u8`

    return new Promise((resolve, reject) => {
        fs.writeFile(localPath, data, err => {
            if (err) {
                reject(null)
            } else {
                resolve(localPath)
            }
        })
    })
}

async function main() {
    const params = await parseParams(videoId)

    const streamUrls = await getStreamUrls(params)

    console.log(streamUrls)

    // 斗鱼的.m3u8文件定义的ts视频的路径是相对路径, 需要转换为绝对路径才可以直接使用播放器播放
    const localPaths = (await Promise.all(Object.keys(streamUrls).map((key) => {
        return downloadM3U8(streamUrls[key], key, videoId)
    }))).filter(value => value)

    if (localPaths.length) {
        console.log('playlist.m3u8已保存到本地 : ', localPaths)
    } else {
        console.log('下载失败')
    }
}


main()
