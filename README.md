## 操作场景

​

智能结构化（Smart Structure Optical Character Recognition ）融合了业界领先的深度学习技术、图像检测技术以及 OCR 大模型能力，能够实现不限版式的结构化信息抽取。本文以NodeJS为例，实现一个基于智能结构化OCR的个人小账本demo。

## 示例软件版本

本文示例的软件版本及说明如下：

- NodeJS：编程语言，本文以NodeJS v20.11.1为例。

## 操作步骤

### 步骤1：创建账户的api密钥

前往[访问密钥](https://console.cloud.tencent.com/cam/capi)页面，新建密钥，记录下生成的`secretId`和`secretKey`。

![请在此添加图片描述](https://developer.qcloudimg.com/http-save/yehe-1004786/b9281bbbe792ce487446b106c0d88005.png?qc_blockWidth=783&qc_blockHeight=353)

### 步骤2：创建对象存储桶

> 智能结构化OCR的sdk支持传入图片链接的方式和使用图片base64的方式。这里使用的是传入图片链接的方式，通过先上传图片到腾讯云对象存储，再将链接传入智能结构化OCR识别。

前往[对象存储](https://console.cloud.tencent.com/cos)的[存储桶列表](https://console.cloud.tencent.com/cos/bucket)创建存储桶，选择公有读写，方便测试。

![请在此添加图片描述](https://developer.qcloudimg.com/http-save/yehe-1004786/c66e5f1236475e62275373fe906eab2a.png?qc_blockWidth=783&qc_blockHeight=378)

记录下存储桶名称和所属地域，所属地域使用英文，例如ap-chengdu。

![请在此添加图片描述](https://developer.qcloudimg.com/http-save/yehe-1004786/71588bb51005762bcaf017cd50303c1d.png?qc_blockWidth=783&qc_blockHeight=373)

### 步骤3：创建项目

#### 1. 新建文件夹，并安装依赖

```bash
mkdir tencentOcr
cd tencentOcr
npm init
npm install -S express body-parser qcloud-cos-sts tencentcloud-sdk-nodejs
```

依赖解读：

- express：Express 是一种保持最低程度规模的灵活 NodeJS Web 应用程序框架。
- body-parser：NodeJS正文解析中间件，这里用来处理post请求的json参数。
- qcloud-cos-sts：是腾讯云对象存储的sdk。
- tencentcloud-sdk-nodejs：腾讯云开发者工具套件，用其中的OCR功能。

项目目录如下，

![请在此添加图片描述](https://developer.qcloudimg.com/http-save/yehe-1004786/98660e4876a17c19f709cc4c5c013bd0.png?qc_blockWidth=219&qc_blockHeight=196)

- `public`文件夹为前端部分
- `.env`为环境变量用来存放`SECRET_ID`，`SECRET_KEY`，`BUCKET`，`REGION`
- `index.js`为项目后端，提供相关接口。

### 步骤4：编写后端代码

#### 1. 首先填写好环境变量

> 将`SECRET_ID`，`SECRET_KEY`，`BUCKET`，`REGION`填入到.env中

```txt
SECRET_ID=腾讯云secretId
SECRET_KEY=腾讯云secretKey
BUCKET=对象存储存储桶名称
REGION=对象存储地域
```

#### 2. 编写代码

1）先引入依赖，并初始化express对象，配置前端页面的文件夹，以及设定启动端口。

```js
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

app.listen(8898, () => {
  console.log('Server is running on port 8898')
})
```

2）配置ocr，并编写调用ocr的接口

sdk调用`SmartStructuralPro`的方法描述可以在[这里查看](https://github.com/TencentCloud/tencentcloud-sdk-nodejs/blob/master/tencentcloud/services/ocr/v20181119/ocr_client.js#L456)

![请在此添加图片描述](https://developer.qcloudimg.com/http-save/yehe-1004786/1ffe277c3c01a4ff68ac770c472b66c3.png?qc_blockWidth=783&qc_blockHeight=91)

代码中我们使用`ImageUrl`来传入需要识别的图片，如果是传base64，需要使用`ImageBase64`。可以根据具体需要获取的字段来指定`ItemNames`，防止获取其他无意义的数据，增加筛选成本。具体如何提升获取效果，可以前往[OCR Demo](https://ocrdemo.cloud.tencent.com/?from_column=20421&from=20421)中通过添加自定义字段尝试效果。

![请在此添加图片描述](https://developer.qcloudimg.com/http-save/yehe-1004786/5c38688f0d22aa8a93bf18a2a844d17a.png?qc_blockWidth=783&qc_blockHeight=396)

```js
// ocr客户端初始化
const OcrClient = TencentCloud.ocr.v20181119.Client
const ocrClient = new OcrClient({
  credential: {
    secretId: process.env.SECRET_ID,
    secretKey: process.env.SECRET_KEY
  }
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
```

3）配置oss，用来给前端上传时获取存储桶和地域，以及临时授权token。

```js
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
    ],
    'effect': 'allow',
    'principal': { 'qcs': ['*'] },
    'resource': [
      // cos相关授权，按需使用
      'qcs::cos:' + stsConfig.region + ':uid/' + stsAppId + ':' + stsConfig.bucket + '/' + stsConfig.allowPrefix,
      // ci相关授权，按需使用
      'qcs::ci:' + stsConfig.region + ':uid/' + stsAppId + ':bucket/' + stsConfig.bucket + '/*',
    ],
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
```

### 步骤5：编写前端代码

#### 1. 编写前端oss操作代码

先下载前端的[oss sdk](https://github.com/tencentyun/cos-js-sdk-v5/blob/master/dist/cos-js-sdk-v5.min.js)，放入`public`文件夹中。

编写代码`public/oss.js`

```js
let bucket = ''
let region = ''
// 创建COS对象
const cos = new COS({
    // 使用临时授权，则需要使用这个属性
  getAuthorization: async function (options, callback) {
    // 调用接口 获取临时授权token
    const res = await fetch('/api/sts').then(res => res.json())
    const data = res.data
    console.log(data)
    if (!data || !data.credentials) {
      return console.error('credentials invalid:\n', data)
    }
    const { credentials } = data
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

// 生成guid，用于文件名生成，防止重复文件冲突
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
```

#### 2. 编写页面逻辑代码

`public/index.html`代码如下，

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <script src="./cos-js-sdk-v5.min.js"></script>
  <script src="./cos.js"></script>
  <style>
    .table {
      width: 100%;
      border-collapse: collapse;
    }
    .table th, .table td {
      border: 1px solid #000;
      padding: 8px;
    }
  </style>
</head>
<body>
  <div>
    <input type="file" id="file" accept="image/*">
    <button id="upload">识别</button>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th>时间</th>
        <th>金额</th>
      </tr>
    </thead>
    <tbody id="tbody">
    </tbody>
  </table>
  <script>
    const file = document.getElementById('file')
    const uploadBtn = document.getElementById('upload')
    // 上传按钮逻辑
    uploadBtn.addEventListener('click', () => {
      // 进行文件上传
      upload(file.files[0], (progressData) => {
        console.log('上传进度：', progressData)
      }, async (data) => {
        console.log('上传成功：', data)
        // 上传成功后，将图片链接传给ocr识别
        const result = await fetch('/api/ocr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            image: 'https://' + data.Location
          })
        }).then(res => res.json())
        // 解析返回的数据
        const extractedData = result.data.StructuralList.flatMap(group => 
          group.Groups.flatMap(groupItem => 
            groupItem.Lines.map(line => ({
              AutoName: line.Key.AutoName,
              AutoContent: line.Value.AutoContent
            }))
          )
        )
        // 渲染到表格中
        const tbody = document.getElementById('tbody')
        // 需要两个autoceontent在一行
        const rows = extractedData.map(item => `<td>${item.AutoContent}</td>`)
        tbody.innerHTML = tbody.innerHTML + `<tr>${rows.join('')}</tr>`
        console.log('识别结果：', extractedData)
      }, (e) => {
        console.log('上传失败：', e)
      })
    })
  </script>
</body>
</html>
```

#### 3. 页面结果展示

![请在此添加图片描述](https://developer.qcloudimg.com/http-save/yehe-1004786/2751f1b31c9faf1bc3d6e2d3a0f91e6e.png?qc_blockWidth=783&qc_blockHeight=271)

上传的示例图片

![请在此添加图片描述](https://developer.qcloudimg.com/http-save/yehe-1004786/ad10f93b3f948394935700946b6a1274.png?qc_blockWidth=433&qc_blockHeight=961)

## 相关操作

可以后续将识别的数据存入[CloudBase 云数据库](https://cloud.tencent.com/product/tcb)或者[腾讯云数据库服务](https://cloud.tencent.com/product/tencentdb-catalog)或者自己搭建的数据库服务中。

## 相关问题

如果您在使用智能结构化OCR或者对象存储的过程中遇到问题，可参考以下文档并结合实际情况分析并解决问题：

- 项目源码，可参见[github](https://github.com/klren0312/TencentOcrDemo)
- 文字识别的使用问题，可参见 [一分钟接入服务端 API](https://cloud.tencent.com/document/product/866/34681)。
- 对象存储的使用问题，可参见[控制台快速入门](https://cloud.tencent.com/document/product/436/38484)。