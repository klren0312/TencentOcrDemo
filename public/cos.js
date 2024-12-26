let bucket = ''
let region = ''
const cos = new COS({
  getAuthorization: async function (options, callback) {
    const res = await fetch('/api/sts').then(res => res.json()) // 需自行实现获取临时密钥逻辑
    const data = res.data
    console.log(data)
    if (!data || !data.credentials) {
      return console.error('credentials invalid:\n', data)
    }
    // 检查credentials格式
    const { credentials } = data
    console.log(credentials)
    callback({
      TmpSecretId: credentials.tmpSecretId,
      TmpSecretKey: credentials.tmpSecretKey,
      SecurityToken: credentials.sessionToken,
      // 建议返回服务器时间作为签名的开始时间，避免客户端本地时间偏差过大导致签名错误
      StartTime: data.startTime, // 时间戳，单位秒，如：1580000000
      ExpiredTime: data.expiredTime, // 时间戳，单位秒，如：1580000000
      ScopeLimit: true, // 细粒度控制权限需要设为 true，会限制密钥只在相同请求时重复使用
    })
  }
})

const guid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

let taskId;
// 上传文件，file为选择的文件
async function upload(file, onProgress, onSuccess, onError) {
  // 获取文件后缀
  const ext = file.name.split('.').pop()
  try {
    const bucketRes = await fetch('/api/bucket').then(res => res.json())
    const { bucket, region } = bucketRes.data
    const data = await cos.uploadFile({
      Bucket: bucket, // 填写自己的 bucket，必须字段
      Region: region,     // 存储桶所在地域，必须字段
      Key: 'ocr/' + guid() + '.' + ext,            // 存储在桶里的对象键（例如1.jpg，a/b/test.txt），必须字段
      Body: file, // 上传文件对象
      SliceSize: 1024 * 1024 * 5,  // 触发分块上传的阈值，超过5MB 使用分块上传，小于5MB使用简单上传。可自行设置，非必须
      onProgress: function(progressData) {
        onProgress && onProgress(progressData)
      },
      onTaskReady: function(id) { // 非必须
        taskId = id;
      },
    })
    onSuccess && onSuccess(data)
  } catch (e) {
    onError && onError(e)
  }
}
