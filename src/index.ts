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

  async save(path: PutObjectCommandInput["Key"], content: PutObjectCommandInput["Body"], contentType?: PutObjectCommandInput["ContentType"]) {
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: path,
      Body: content,
      ContentType: contentType
    });

    return [this.endpoint.replace('//', '//' + this.bucket + '.'), path].join('/')
  }

  async download(url: string, directory: string = '') {
    const { fileName, contentType, buffer } = await download(url);
    const result = await this.save(directory + fileName, buffer, contentType);
    return result;
  }

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

  async delete(Key: string) {
    const result = await this.s3.deleteObject({
      Key,
      Bucket: this.bucket
    })

    return result
  }

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