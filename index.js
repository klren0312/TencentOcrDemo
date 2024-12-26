import express from 'express'
import bodyParser from 'body-parser'
import TencentCloud from 'tencentcloud-sdk-nodejs'
import STS from 'qcloud-cos-sts'

const app = express()
const jsonParser = bodyParser.json()

// 静态资源
app.use(express.static('public'))

// api 根路由
const ROOT_ROUTE = '/api'

const formatResponse = (data, code = 0, message = 'success') => {
  return {
    code,
    message,
    data
  }
}

// ocr客户端初始化
const OcrClient = TencentCloud.ocr.v20181119.Client
const ocrClient = new OcrClient({
  credential: {
    secretId: process.env.SECRET_ID,
    secretKey: process.env.SECRET_KEY
  }
})

// 配置oss sts
const stsConfig = {
  secretId: process.env.SECRET_ID,
  secretKey: process.env.SECRET_KEY,
  durationSeconds: 1800,
  bucket: process.env.BUCKET,
  region: process.env.REGION,
  allowPrefix: 'ocr/*',
}

const stsAppId = stsConfig.bucket.substring(stsConfig.bucket.lastIndexOf('-') + 1)
const stsPolicy = {
  'version': '2.0',
  'statement': [{
    'action': [
      // 简单上传
      'name/cos:PutObject',
      'name/cos:PostObject',
      // 分片上传
      'name/cos:InitiateMultipartUpload',
      'name/cos:ListMultipartUploads',
      'name/cos:ListParts',
      'name/cos:UploadPart',
      'name/cos:CompleteMultipartUpload',
      // 简单上传和分片，需要以上权限，其他权限列表请看 https://cloud.tencent.com/document/product/436/31923

      // 文本审核任务
      'name/ci:CreateAuditingTextJob',
      // 开通媒体处理服务
      'name/ci:CreateMediaBucket'
      // 更多数据万象授权可参考：https://cloud.tencent.com/document/product/460/41741
    ],
    'effect': 'allow',
    'principal': { 'qcs': ['*'] },
    'resource': [
      // cos相关授权，按需使用
      'qcs::cos:' + stsConfig.region + ':uid/' + stsAppId + ':' + stsConfig.bucket + '/' + stsConfig.allowPrefix,
      // ci相关授权，按需使用
      'qcs::ci:' + stsConfig.region + ':uid/' + stsAppId + ':bucket/' + stsConfig.bucket + '/*',
    ],
    // condition生效条件，关于 condition 的详细设置规则和COS支持的condition类型可以参考https://cloud.tencent.com/document/product/436/71306
    // 'condition': {
    //   // 比如限定ip访问
    //   'ip_equal': {
    //     'qcs:ip': '10.121.2.10/24'
    //   }
    // }
  }],
}

// 获取oss的bucket和region
app.get(`${ROOT_ROUTE}/bucket`, async (req, res) => {
  res.json(formatResponse({
    bucket: process.env.BUCKET,
    region: process.env.REGION,
  }, 0, '获取bucket和region成功'))
})

// 获取sts凭证
app.get(`${ROOT_ROUTE}/sts`, async (req, res) => {
  STS.getCredential({
    secretId: stsConfig.secretId,
    secretKey: stsConfig.secretKey,
    proxy: stsConfig.proxy,
    durationSeconds: stsConfig.durationSeconds,
    region: stsConfig.region,
    endpoint: stsConfig.endpoint,
    policy: stsPolicy,
  }, function (err, credential) {
    if (err) {
      res.json(formatResponse(err, 1, '获取sts凭证失败'))
    } else {
      res.json(formatResponse(credential, 0, '获取sts凭证成功'))
    }
  })
})

// ocr
app.post(`${ROOT_ROUTE}/ocr`, jsonParser, async (req, res) => {
  const { image } = req.body
  const response = await ocrClient.SmartStructuralPro({
    ImageUrl: image,
    ItemNames: ['支付时间', '金额']
  })
  res.json(formatResponse(response, 0, 'ocr成功'))
})

app.listen(8898, () => {
  console.log('Server is running on port 8898')
})