# binary compatible with RHEL/CentOS
FROM public.ecr.aws/lambda/nodejs:14
ENV LD_LIBRARY_PATH=/usr/local/lib:/usr/lib:/usr/local/lib64:/usr/lib64

# install
RUN yum update -y && yum upgrade -y
RUN yum install -y gcc10 gcc10-c++ glibc-devel glibc-static libtool make cmake3 git sed unzip curl
RUN ln -s /usr/bin/gcc10-g++ /usr/bin/g++ && ln -s /usr/bin/cmake3 /usr/bin/cmake
RUN npm install --global yarn
RUN yarn global add node-gyp --prefix /usr/local

WORKDIR /lab
RUN git clone -b master https://github.com/zeux/pugixml.git
WORKDIR /lab/pugixml/cmake-build
RUN cmake -DCMAKE_BUILD_TYPE=Release .. && make install

# project
WORKDIR ${LAMBDA_TASK_ROOT}
COPY . .
RUN yarn install --check-files && rm -rf /lab

# app-server
ENTRYPOINT [ "node", "index.js" ]
# ENTRYPOINT [ "tail", "-f", "/dev/null" ]