# miniPaint (MIT, https://github.com/viliusle/miniPaint): a full browser image editor
# with layers, selections, filters, effects, text and PNG/JPG/WEBP/GIF export.
# The release ships a prebuilt bundle, so we only fetch it and serve it with nginx.
FROM alpine/git:2.47.2 AS src
ARG MINIPAINT_VERSION=v4.14.3
RUN git clone --depth 1 --branch ${MINIPAINT_VERSION} https://github.com/viliusle/miniPaint.git /src \
 && rm -rf /src/.git

FROM nginx:1.27-alpine
COPY --from=src /src/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
# wb-sync.js: mirror the whiteboard into a "Whiteboard" layer
# no-tools.js: Paint's own drawing tools are disabled (Paint shows the whiteboard)
COPY wb-sync.js no-tools.js /usr/share/nginx/html/
RUN sed -i 's#</body>#<script src="wb-sync.js"></script>\n<script src="no-tools.js"></script>\n</body>#' /usr/share/nginx/html/index.html \
 && grep -q 'wb-sync.js' /usr/share/nginx/html/index.html \
 && grep -q 'no-tools.js' /usr/share/nginx/html/index.html
