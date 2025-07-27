const cdnHeaders = {
    server: (value, name) => {
        if (value.includes('cloudflare')) {
            return { provider: 'Cloudflare', cdn: 'Cloudflare' };
        }
        if (value.includes('ECS')) {
            return { provider: 'Akamai', cdn: 'EdgePlatform' };
        }
        if (value.includes('GSE')) {
            return { provider: 'Google', cdn: 'GSE' };
        }
        if (value.includes('gws')) {
            return { provider: 'Google', cdn: 'GWS' };
        }
        if (value.includes('sffe')) {
            return { provider: 'Google', cdn: 'GFE' };
        }
        if (value.includes('tsa_b')) {
            return { provider: 'Google', cdn: 'TSA' };
        }
        if (value.match(/AliyunOSS/i)) {
            return { provider: 'Alibaba Cloud', cdn: 'Alibaba Cloud OSS' };
        }
        if (value.includes('Cdn Cache Server')) {
            return { provider: 'ChinaNet', cdn: 'ChinaNet' };
        }
    },
    'x-amz-id-2': (value, name) => {
        return { provider: 'Amazon Web Services', cdn: 'Amazon S3' };
    },
    'x-amz-request-id': (value, name) => {
        return { provider: 'Amazon Web Services', cdn: 'Amazon S3' };
    },
    'x-oss-request-id': (value, name) => {
        return { provider: 'Alibaba Cloud', cdn: 'Alibaba Cloud OSS' };
    },
    'x-cos-request-id': (value, name) => {
        return { provider: 'Tencent Cloud', cdn: 'Tencent Cloud COS' };
    },
    'x-obs-request-id': (value, name) => {
        return { provider: 'Huawei Cloud', cdn: 'Huawei Cloud OBS' };
    },
    'CF-RAY': (value, name) => {
        return { provider: 'Cloudflare', cdn: 'Cloudflare' };
    },
    'x-amz-cf-id': (value, name) => {
        return { provider: 'Amazon Web Services', cdn: 'Amazon CloudFront' };
    },
    'x-cache': (value, name) => {
        if (value.includes('cloudfront')) {
            return { provider: 'Amazon Web Services', cdn: 'Amazon CloudFront' };
        }
    },
};
