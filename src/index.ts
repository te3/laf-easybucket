import { S3, PutObjectCommandInput, ListObjectsV2CommandInput, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type Environment = {
  OSS_EXTERNAL_ENDPOINT: string;
  OSS_REGION: string;
  OSS_ACCESS_KEY: string;
  OSS_ACCESS_SECRET: string;
}

export class EasyBucket {
  private bucket: string
  private endpoint: string
  private s3: S3;

   /**
    * 使用指定的 Laf 存储桶名称创建 EasyBucket 类的新实例。
    * Creates a new instance of the EasyBucket class with the specified Laf bucket name.
    * @constructor
    * @param {string} bucket - Laf 存储桶的名称。The name of the Laf bucket.
    * @param {string} env - Laf 环境变量，默认可不填。The Environment of the Laf bucket.
    */
  constructor(bucket: string, env: Environment = require("@lafjs/cloud").default.env) {
    this.bucket = bucket;

    this.endpoint = env.OSS_EXTERNAL_ENDPOINT;
    this.s3 = new S3({
      endpoint: this.endpoint,
      region: env.OSS_REGION,
      credentials: {
        accessKeyId: env.OSS_ACCESS_KEY,
        secretAccessKey: env.OSS_ACCESS_SECRET
      },
      forcePathStyle: true,
    })
  }

  /**
    * 将内容保存到 Laf 存储桶中指定的路径。
    * Saves content to the specified path in the Laf bucket.
    * @param {string} path - 要保存内容的路径。The path to save the content to.
    * @param {Buffer | Uint8Array | ReadableStream | Blob | string} content - 要保存的内容。The content to save.
    * @param {string} contentType - 内容的 MIME 类型。The MIME type of the content.
    * @returns {Promise<string>} - 一个 Promise，解析为已保存内容的 URL。A Promise that resolves to the URL of the saved content.
    */
  async save(path: PutObjectCommandInput["Key"], content: PutObjectCommandInput["Body"], contentType?: PutObjectCommandInput["ContentType"]) {
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: path,
      Body: content,
      ContentType: contentType
    });

    return [this.endpoint.replace('//', '//' + this.bucket + '.'), path].join('/')
  }

  /**
   * 从 URL 下载文件并将其保存到 Laf 存储桶中指定的目录。
   * Downloads a file from a URL and saves it to the specified directory in the Laf bucket.
   * @param {string} url - 要下载的文件的 URL。The URL of the file to download.
   * @param {string} [directory=""] - 要保存文件的 Laf 存储桶中的目录，默认为空字符串。The directory in the Laf bucket to save the file to.
   * @returns {Promise<string>} - 一个 Promise，解析为已保存文件的 URL。A Promise that resolves to the URL of the saved file.
   */
  async download(url: string, directory: string = '') {
    const { fileName, contentType, buffer } = await download(url);
    const result = await this.save(directory + fileName, buffer, contentType);
    return result;
  }
  
  /**
   * 列出 Laf 存储桶中的对象。
   * Lists objects in the Laf bucket.
   * @param {number} [size] - 要返回的对象的最大数量。不填表示返回所有对象。The maximum number of objects to return.
   * @param {string} [prefix] - 按前缀筛选对象的前缀。不填表示不使用前缀筛选。The prefix to filter objects by.
   * @param {string} [startAfter] - 列出对象的起始位置。不填表示从第一个对象开始列出。The object key to start listing after.
   * @returns {Promise<ListResult>} - 一个 Promise，解析为一个包含对象列表和 `more` 函数的对象，用于获取下一页结果。A Promise that resolves to an object containing the list of objects and a `more` function to get the next page of results.
   */
  async list(
    size: ListObjectsV2CommandInput["MaxKeys"],
    prefix?: ListObjectsV2CommandInput["Prefix"],
    startAfter?: ListObjectsV2CommandInput['StartAfter'],
  ) {
    const result = await this.s3.listObjectsV2({
      Bucket: this.bucket,
      MaxKeys: size,
      Prefix: prefix,
      StartAfter: startAfter
    })

    const { Contents: list = [], IsTruncated } = result
    const lastKey = list.slice(-1)?.[0]?.Key;

    return {
      list,
      more: !IsTruncated ?
        null :
        () => this.list(size, prefix, lastKey)
    }
  }

  /**
   * 从 Laf 存储桶中删除对象。
   * Deletes an object from the Laf bucket.
   * @param {string} Key - 要删除的对象的键。The object key to delete.
   * @returns {Promise<void>} - 一个 Promise，当对象被删除时解析。A Promise that resolves when the object is deleted.
   */
  async delete(Key: string) {
    const result = await this.s3.deleteObject({
      Key,
      Bucket: this.bucket
    })

    return result
  }

  /**
   * 从 Laf 存储桶中删除指定前缀的对象。
   * Deletes objects with the specified prefix from the Laf bucket.
   * @param {string} prefix - 按前缀筛选要删除的对象。The prefix to filter objects by.
   * @param {number} [page=1] - 要删除的对象的页码。默认为 1，表示从第一页开始删除。The page number of objects to delete.
   * @returns {Promise<boolean>} - 一个 Promise，当所有具有指定前缀的对象都被删除时，解析为 `true`。A Promise that resolves to `true` when all objects with the specified prefix are deleted.
   */
  async deleteByPrefix(prefix: ListObjectsV2CommandInput["Prefix"], page: number = 1) {
    const size = 200;
    const { list, more } = await this.list(size, prefix);
    if (!list.length) return true;

    console.log('page size=', size, ', delete page', page);
    const Objects = list.map(({ Key }) => ({ Key }));
    await this.s3.deleteObjects({
      Bucket: this.bucket,
      Delete: {
        Objects
      }
    });

    return more ? this.deleteByPrefix(prefix, page + 1) : true;
  }

  /**
   * 获取用于从 Laf 存储桶中下载对象的签名 URL。
   * Gets a signed URL for downloading an object from the Laf bucket.
   * @param {string} Key - 要获取签名 URL 的对象键。The object key to get the signed URL for.
   * @param {number} expiresSeconds - 签名 URL 的有效期，以秒为单位。The number of seconds until the signed URL expires.
   * @returns {Promise<string>} - 一个 Promise，解析为签名 URL。A Promise that resolves to the signed URL.
   */
  async getShareURL(Key: string, expiresSeconds: number = 3600) {
    const url = await getSignedUrl(this.s3, new GetObjectCommand({
      Bucket: this.bucket,
      Key,
    }), { expiresIn: expiresSeconds });
    return url;

  }
}

const getRandomId = () => (BigInt(Date.now() - 14200704e5) * BigInt(Math.round(Math.random() * 3194304 + 1000000))).toString();

async function download(url: string) {
  const fileResponse = await globalThis.fetch(url);
  const contentType = fileResponse.headers.get("content-type");
  const fileExtention = require('mime-types').extension(contentType)
  const fileName = getRandomId() + "." + fileExtention
  const arrayBuffer = await fileResponse.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer);

  return {
    fileName,
    contentType,
    buffer
  }
}