# only for [laf](https://laf.dev/).

## install
![image](https://github.com/te3/easybucket/blob/main/snapshot.png)


## import and initialize
```javascript
import { EasyBucket } from 'laf-easybucket';

const easyBucket = new EasyBucket("your-buck-name");
```

## method

**save**(path: string, content: string | internal.Readable | ReadableStream<any> | Blob | Uint8Array | Buffer, contentType?: string): Promise\<string>
> save content to object named with given key in bucket.
```javascript
const url = await easyBucket.save('index.html', 'Hello World'); 
//https://your-buck-name.oss.laf.dev/index.html
```

**download**(url: string, directory?: string): Promise\<string>
> directly save the source of the url to bucket with random filename.
```javascript
const url = await easyBucket.download('http://www.baidu.com/1.jpg', 'tmp/');
///https://your-buck-name.oss.laf.dev/tmp/20481848184245.jpeg
```

**list**(size: number, prefix?: string, startAfter?: string): Promise<{list: _Object[];more: () => Promise<...>;}>
> list objects
```javascript
const { list, more } = await easyBucket.list(50, 'tmp/');
```

**delete**(Key: string): Promise\<DeleteObjectCommandOutput>
> delete single object by object's name

> *the result doesn't make sense to distinguish deleted success
```javascript
await easyBucket.delete('tmp/20481848184245.jpeg')
```

**deleteByPrefix**(prefix: string): boolean 
> delete all objects start with prefix
```javascript
const result = await easyBucket.deleteByPrefix('tmp/')
```

**getShareURL**(Key: string, expiresSeconds: number=3600): Promise\<string>
> get share URL of object, expires in seconds.
````javascript
const url = await easyBucket.getShareURL('tmp/20481848184245.jpeg');
//https://oss.laf.dev/your-bucket-name/tmp/20481848184245.jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=6T35PHC12IQW25PMML0C%2F20230402%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20230402T134016Z&X-Amz-Expires=900&X-Amz-Security-Token=eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NLZXkiOiI2VDM1UEhDMTJJUVcyNVBNTUwwQyIsImV4cCI6MTY4MTAzNzU5NCwicGFyZW50IjoidWZuMmcyIiwic2Vzc2lvblBvbGljeSI6ImV5SldaWEp6YVc5dUlqb2lNakF4TWkweE1DMHhOeUlzSWxOMFlYUmxiV1Z1ZENJNlczc2lVMmxrSWpvaVlYQndMWE4wY3kxbWRXeHNMV2R5WVc1MElpd2lSV1ptWldOMElqb2lRV3hzYjNjaUxDSkJZM1JwYjI0aU9pSnpNem9xSWl3aVVtVnpiM1Z5WTJVaU9pSmhjbTQ2WVhkek9uTXpPam82S2lKOVhYMD0ifQ.DhhUuDxuabdZG9qrCLUJexpLZfBHHtsjoLJtQ-3299490UwEomK3k84jt-2JNN7WntBflWrYfTRnDgvKXKyl8A&X-Amz-Signature=309ee8a8f928d9c444dc65c74e5f7afd630294585d4ae9f8aad05021bba67b15&X-Amz-SignedHeaders=host
```
