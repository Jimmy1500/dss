# binary compatible with RHEL/CentOS
FROM public.ecr.aws/lambda/nodejs:14
ENV LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/usr/local/lib64:/usr/lib64

# install
RUN yum update -y && yum upgrade -y
RUN yum install -y gcc10 gcc10-c++ glibc-devel glibc-static libtool make cmake3 git sed unzip curl
RUN ln -s /usr/bin/gcc10-g++ /usr/bin/g++ && ln -s /usr/bin/cmake3 /usr/bin/cmake
RUN npm install --global yarn && yarn global add node-gyp --prefix /usr/local

# project
WORKDIR ${LAMBDA_TASK_ROOT}
COPY bin/get_data.sh bin/get_data.sh

COPY sls sls
COPY src src
COPY index.js index.js
COPY package.json package.json
COPY yarn.lock yarn.lock
COPY serverless.yml serverless.yml

RUN yarn add serverless nodemon --dev
RUN yarn install --check-files

# app-server
ENTRYPOINT [ "node", "index.js" ]
# ENTRYPOINT [ "tail", "-f", "/dev/null" ]