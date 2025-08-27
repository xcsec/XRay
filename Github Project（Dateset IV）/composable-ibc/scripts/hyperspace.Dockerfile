FROM paritytech/ci-unified:bullseye-1.73.0-2023-05-23 as builder

WORKDIR /code

COPY . .

ENV PATH="/usr/local/protoc/bin:$PATH"

RUN curl -LO https://github.com/protocolbuffers/protobuf/releases/download/v21.9/protoc-21.9-linux-x86_64.zip && \
	unzip  protoc-21.9-linux-x86_64.zip -d /usr/local/protoc && \
	protoc --version

RUN cargo build --release --locked -p hyperspace

# =============

FROM debian:bullseye-slim

RUN useradd -m -u 1000 -U -s /bin/sh -d /centauri centauri

RUN mkdir /centauri/data

COPY --from=builder /code/target/release/hyperspace /usr/local/bin

# add ca certificates so that it works with ssl endpoints
RUN apt update && \
	apt install -y ca-certificates

# checks
RUN ldd /usr/local/bin/hyperspace && \
	/usr/local/bin/hyperspace --help

# Shrinking
RUN rm -rf /usr/lib/python* && \
	rm -rf /usr/sbin /usr/share/man

USER centauri


VOLUME ["/centauri/data"]

ENTRYPOINT ["/usr/local/bin/hyperspace"]
