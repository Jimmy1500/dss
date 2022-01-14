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
# aws cli (version 2)
# RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
# RUN unzip awscliv2.zip
# RUN ./aws/install

# glog && pugixml
RUN git clone -b master https://github.com/google/glog.git && git clone -b master https://github.com/zeux/pugixml.git
WORKDIR /lab/glog/cmake-build
RUN cmake -DCMAKE_BUILD_TYPE=Release .. && make && make install
WORKDIR /lab/pugixml/cmake-build
RUN cmake -DCMAKE_BUILD_TYPE=Release .. && make && make install

# project
WORKDIR ${LAMBDA_TASK_ROOT}
COPY . .
RUN yarn install --check-files && rm -rf /lab

# app-server
ENTRYPOINT [ "node", "index.js" ]