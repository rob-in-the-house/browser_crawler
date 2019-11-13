import pika
import signal
import socket
import time
import json
import base64
import zlib
import redis
import binascii
import os
import fcntl
from subprocess import Popen, PIPE

from base.log import logger
from base.gflags import *
from base.http_monitor import ServletHTTPRequestHandler, HTTPMonitor

DEFINE_string("redis_host", "10.10.0.x", "redis server host")
DEFINE_integer("redis_port", 6379, "redis server listen port")
DEFINE_string("redis_queue_name", "weibo", "rpc queue name")
DEFINE_string("username", "", "weibo username")
DEFINE_string("password", "", "weibo username")
DEFINE_string("script", "weibo.js", "weibo script")


class SlimerJSServer(HTTPMonitor):
    def __init__(self):
        self.compressor = zlib.compressobj(6)
        HTTPMonitor.__init__(self, handler=ServletHTTPRequestHandler)
        self.cmd = ""
        self.starttime = 0
        self.pgid = 0
        pool = redis.ConnectionPool(host=FLAGS.redis_host, port=FLAGS.redis_port)
        self.redis_client = redis.Redis(connection_pool=pool)

    def http_monitor_callback(self):
        buff = "<body>"
        buff += "Server address: %s:%s<br>" % (socket.gethostbyname(socket.gethostname()), FLAGS.http_port)
        buff += "Time cost: %s seconds<br>" % ((time.time() - self.starttime) if self.starttime > 0 else 0)
        buff += "Running Task:"
        if self.cmd:
            buff += " %s" % self.cmd
        else:
            buff += " Idle"
        buff += "</body>"
        return buff

    def process(self):
        logger.info("Starting weibo subprocess")
        obj = {}
        obj['username'] = FLAGS.username
        obj['password'] = FLAGS.password
        self.cmd = "slimerjs --headless --debug=false ./scripts/%s '%s' 2>/dev/null" % (FLAGS.script, json.dumps(obj))
        logger.info(self.cmd)
        self.starttime = time.time()
        process = Popen(self.cmd, stdout=PIPE, shell=True, preexec_fn=os.setpgrp)
        self.pgid = os.getpgid(process.pid)
        logger.info("Start subprocess pgid %s" % self.pgid)
        fd = process.stdout.fileno()
        fl = fcntl.fcntl(fd, fcntl.F_GETFL)
        fcntl.fcntl(fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)
        while True:
            try:
                line = process.stdout.readline()
                if line == None:
                    time.sleep(1)
                    continue
                line = line.strip()
                if not line:
                    time.sleep(1)
                    continue
                if line.startswith('[DATA]:'):
                    logger.info("before payload size:%s" % len(line))
                    self.redis_client.lpush(FLAGS.redis_queue_name, line)
                else:
                    logger.info(line)
            except:
                continue

    def cleanup(self):
        os.killpg(self.pgid, 9)

    def signal_handler(self, signum, frame):
        logger.info("[INFO] - catched signal %d" % signum)
        self.cleanup()
        os._exit(0)


def main():
    try:
        reload(sys)
        sys.setdefaultencoding('utf8')
        argv = FLAGS(sys.argv)
        server = SlimerJSServer()
        signal.signal(signal.SIGINT, server.signal_handler)
        ServletHTTPRequestHandler.register_callback(server.http_monitor_callback)
        server.process()
    except FlagsError, e:
        logger.exception(e)
        sys.exit(1)

if __name__ == "__main__":
    main()
