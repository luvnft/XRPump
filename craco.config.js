const webpack = require('webpack');

module.exports = {
    webpack: {
        configure: {
            resolve: {
                fallback: {
                    "zlib": require.resolve("browserify-zlib"),
                    "crypto": require.resolve("crypto-browserify"),
                    "stream": require.resolve("stream-browserify"),
                    "http": require.resolve("stream-http"),
                    "https": require.resolve("https-browserify"),
                    "url": require.resolve("url/"),
                    "buffer": require.resolve("buffer/"),
                    "assert": false,
                    "path": false,
                    "fs": false
                }
            }
        },
        plugins: {
            add: [
                new webpack.ProvidePlugin({
                    Buffer: ['buffer', 'Buffer'],
                    process: 'process/browser',
                })
            ]
        }
    },
    devServer: {
        allowedHosts: [
            'localhost',
            '.ngrok-free.app',
            'xr-pump.vercel.app',
            'xrp.hahz.live',
            '.ngrok.io'
        ],
        setupMiddlewares: (middlewares, devServer) => {
            if (!devServer) {
                throw new Error('webpack-dev-server is not defined');
            }
            return middlewares;
        }
    }
}; 