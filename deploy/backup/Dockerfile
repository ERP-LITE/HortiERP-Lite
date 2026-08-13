FROM postgres:16-alpine

RUN apk add --no-cache openssl rclone tzdata curl

COPY deploy/backup/backup.sh /usr/local/bin/backup.sh
COPY deploy/backup/restore-test.sh /usr/local/bin/restore-test.sh

RUN chmod 755 /usr/local/bin/backup.sh /usr/local/bin/restore-test.sh

ENTRYPOINT []
CMD ["/usr/local/bin/backup.sh"]
