#!/bin/sh
# Copies add-in into the invoking user's jsaddons (typical: sudo dpkg -i).
# 麒麟 / UOS 等环境下若用图形界面安装 .deb，可能没有 SUDO_USER，需额外推断登录用户。
set -e
INSTALL_ROOT="__INSTALL_ROOT__"
META="$INSTALL_ROOT/install.json"
if ! test -f "$META"; then
	echo "chayuan-wps-addon: missing $META" >&2
	exit 1
fi
# 用 sed 解析 addonFolder，避免依赖 python3
# install.json 含多个 addonFolder：第一个=主宿主目录，其余=表格/演示宿主目录
ADDON_FOLDER="$(sed -n 's/.*"addonFolder"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$META" | head -1)"
if test -z "$ADDON_FOLDER"; then
	echo "chayuan-wps-addon: cannot read addonFolder from $META" >&2
	exit 1
fi
HOST_FOLDERS="$(sed -n 's/.*"addonFolder"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$META" | tail -n +2)"

# 替换式安装：清除旧版本加载项目录（chayuan_<ver> / chayuan-et_<ver> / chayuan-wpp_<ver>），
# 只保留本次安装的目录。目录条目删不掉（父目录 root 属主）时退化为清空内容。
cleanup_old_addons() {
	DEST="$1"
	PREFIX="$(printf '%s' "$ADDON_FOLDER" | sed 's/_.*//')"
	KEEP="$(printf '%s %s' "$ADDON_FOLDER" "$HOST_FOLDERS")"
	for ENTRY in "$DEST"/${PREFIX}_* "$DEST"/${PREFIX}-et_* "$DEST"/${PREFIX}-wpp_* "$DEST"/.${PREFIX}*.installing; do
		test -d "$ENTRY" || continue
		BASE="$(basename "$ENTRY")"
		SKIP=0
		for K in $KEEP; do
			if test "$BASE" = "$K"; then SKIP=1; break; fi
		done
		test "$SKIP" -eq 0 || continue
		if rm -rf "$ENTRY" 2>/dev/null && ! test -d "$ENTRY"; then
			echo "chayuan-wps-addon: removed old addon dir: $BASE"
		else
			find "$ENTRY" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
			echo "chayuan-wps-addon: emptied old addon dir (parent not writable): $BASE"
		fi
	done
}

# 主宿主 + 表格/演示宿主目录一起安装
install_all() {
	DEST="$1"
	for FOLDER in "$ADDON_FOLDER" $HOST_FOLDERS; do
		test -d "$INSTALL_ROOT/$FOLDER" || continue
		rm -rf "$DEST/$FOLDER"
		cp -R "$INSTALL_ROOT/$FOLDER" "$DEST/"
	done
}

# 同步 jsplugins.xml：WPS(Linux) 实际按 jsplugins.xml 加载本地插件，publish.xml 只是
# wpsjs 在线安装清单。只更新本产品三条目，其它插件条目原样保留；旧条目指向已清理
# 删除的版本目录会让 WPS 加载失败/回退旧缓存。
# 注意：只取 <jsplugin>（本地条目）。publish-merge-fileurl.py 会往 publish.xml 里写
# <jspluginonline file:///opt/.../chayuan_<版本>>——那是指向具体版本目录的在线条目，
# 一旦同步进 jsplugins.xml 就形成同名双注册；下次升级版本目录被替换后该条目变成
# 幽灵 URL，WPS 解析到不存在的路径 → 任务窗格白屏（Kasm 真机实测复现）。
sync_jsplugins() {
	dest="$1"
	pb="$dest/publish.xml"
	jp="$dest/jsplugins.xml"
	if ! test -f "$pb"; then return 0; fi
	entries="$(grep '<jsplugin name="chayuan' "$pb" || true)"
	if test -z "$entries"; then return 0; fi
	if ! test -f "$jp" || ! grep -q '<jsplugins' "$jp" 2>/dev/null; then
		{
			echo '<?xml version="1.0" encoding="UTF-8"?>'
			echo '<jsplugins>'
			echo "$entries"
			echo '</jsplugins>'
		} > "$jp" 2>/dev/null || return 0
		chown "$TARGET_USER:$TARGET_USER" "$jp" 2>/dev/null || true
		echo "chayuan-wps-addon: wrote jsplugins.xml -> $dest"
		return 0
	fi
	tmp="$jp.sync"
	{
		echo '<?xml version="1.0" encoding="UTF-8"?>'
		echo '<jsplugins>'
		# 剔除旧文件的 xml 声明、开/闭 <jsplugins> 标签与全部 chayuan 条目（本地+online），
		# 只保留其它插件的条目。开标签不剔会产生双 <jsplugins> 根 → 畸形 XML，
		# WPS 宽容解析时部分宿主（实测 ET）会丢条目 → 表格/演示端加载项不加载。
		grep -v 'name="chayuan' "$jp" 2>/dev/null \
			| grep -vx '<jsplugins>' | grep -vx '</jsplugins>' | grep -v '<?xml' || true
		echo "$entries"
		echo '</jsplugins>'
	} > "$tmp" 2>/dev/null || { rm -f "$tmp"; return 0; }
	mv -f "$tmp" "$jp" 2>/dev/null || { rm -f "$tmp"; return 0; }
	chown "$TARGET_USER:$TARGET_USER" "$jp" 2>/dev/null || true
	echo "chayuan-wps-addon: synced jsplugins.xml -> $dest"
}

# 刷新 authaddin.json（WPS 的加载项授权登记）：剔除 name=chayuan* 且 path 指向不存在
# 目录的幽灵记录。升级换版本目录后旧记录若不清理，WPS 会继续按旧 path 加载任务窗格
# → 目录不存在 → 白屏，且反复弹「加载项已被修改」。记录剔除失败则整个文件删除，
# 让 WPS 按 jsplugins.xml 重新走首次信任流程（代价仅一次信任弹窗）。
refresh_authaddin() {
	dest="$1"
	aa="$dest/authaddin.json"
	test -f "$aa" || return 0
	python3 - "$aa" <<'PYEOF' 2>/dev/null || { rm -f "$aa" 2>/dev/null || true; return 0; }
import json, os, sys

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    data = json.load(f)

changed = False
for section in data.values():
    if not isinstance(section, dict):
        continue
    for key, rec in list(section.items()):
        if key == "namelist" or not isinstance(rec, dict):
            continue
        name = str(rec.get("name", ""))
        rec_path = str(rec.get("path", ""))
        if name.startswith("chayuan") and rec_path and not os.path.isdir(rec_path):
            section.pop(key, None)
            changed = True
    namelist = section.get("namelist")
    if changed and isinstance(namelist, str):
        keep = {k for k in section if k != "namelist"}
        if len(namelist) % 32 == 0:
            section["namelist"] = "".join(
                namelist[i:i + 32] for i in range(0, len(namelist), 32)
                if namelist[i:i + 32] in keep
            )
        else:
            section.pop("namelist", None)

if changed:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    print("authaddin refreshed")
PYEOF
}

merge_publish_online() {
	PUBLISH_XML="$1"
	if test -f "$INSTALL_ROOT/publish-merge-fileurl.py"; then
		python3 "$INSTALL_ROOT/publish-merge-fileurl.py" "$INSTALL_ROOT" "$PUBLISH_XML"
	fi
}

# Prefer the user who invoked sudo; avoid installing only under /root when possible.
TARGET_USER="${SUDO_USER:-}"
if test -z "$TARGET_USER" || test "$TARGET_USER" = "root"; then
	TARGET_USER="${LOGNAME:-}"
fi
if test -z "$TARGET_USER" || test "$TARGET_USER" = "root"; then
	TARGET_USER="$(logname 2>/dev/null || true)"
fi
if test -z "$TARGET_USER" || test "$TARGET_USER" = "root"; then
	if test -n "${PKEXEC_UID:-}"; then
		TARGET_USER="$(getent passwd "$PKEXEC_UID" 2>/dev/null | cut -d: -f1)"
	fi
fi
# 图形界面双击安装（软件中心 / GDebi 等）常无 SUDO_USER；pkexec 外再推断桌面会话用户
if test -z "$TARGET_USER" || test "$TARGET_USER" = "root"; then
	if test -n "${SUDO_UID:-}"; then
		TARGET_USER="$(getent passwd "$SUDO_UID" 2>/dev/null | cut -d: -f1)"
	fi
fi
if test -z "$TARGET_USER" || test "$TARGET_USER" = "root"; then
	if command -v loginctl >/dev/null 2>&1; then
		TARGET_USER="$(loginctl list-users --no-legend 2>/dev/null | awk 'NR>1 && $1+0 >= 1000 && $2 != "" && $2 != "root" { print $2; exit }')"
	fi
fi
if test -z "$TARGET_USER" || test "$TARGET_USER" = "root"; then
	for RUNDIR in /run/user/[0-9]*; do
		test -d "$RUNDIR" || continue
		uid="${RUNDIR##*/}"
		case "$uid" in ''|*[!0-9]*) continue ;; esac
		test "$uid" -ge 1000 || continue
		u="$(getent passwd "$uid" | cut -d: -f1)"
		if test -n "$u" && test "$u" != "root"; then
			TARGET_USER="$u"
			break
		fi
	done
fi

# 官网 deb、UOS/麒麟应用商店等多套 office6 布局（与 wpsjs GetExePath 探测一致，并多列常见变体）
for OFFICE6 in \
	"/opt/kingsoft/wps-office/office6" \
	"/opt/apps/cn.wps.wps-office-pro/files/kingsoft/wps-office/office6" \
	"/opt/apps/cn.wps.wps-office/files/kingsoft/wps-office/office6"
do
	if test -d "$OFFICE6"; then
		ALT="$OFFICE6/jsaddons"
		mkdir -p "$ALT"
		# 安装前先清理历史版本目录，装完只剩最新版本（装后兜底再扫一遍）
		cleanup_old_addons "$ALT"
		install_all "$ALT" || true
		cp -f "$INSTALL_ROOT/publish.xml" "$ALT/" || true
		merge_publish_online "$ALT/publish.xml"
		sync_jsplugins "$ALT"
		refresh_authaddin "$ALT"
		chmod -R a+rX "$ALT" 2>/dev/null || true
		cleanup_old_addons "$ALT"
		echo "chayuan-wps-addon: also copied to $ALT"
	fi
done

if test -z "$TARGET_USER" || test "$TARGET_USER" = "root"; then
	echo "chayuan-wps-addon: 未能确定当前登录用户，未写入家目录。请将 $INSTALL_ROOT 下的 $ADDON_FOLDER 与 publish.xml 复制到 ~/.local/share/Kingsoft/wps/jsaddons/ 后重启 WPS。" >&2
	echo "chayuan-wps-addon: Could not determine non-root user; home directory copy skipped" >&2
	if test -x "/opt/apps/cn.wps.wps-office-pro/files/bin/quickstartoffice"; then
		echo "chayuan-wps-addon: 若已部署到 office6/jsaddons，可尝试: /opt/apps/cn.wps.wps-office-pro/files/bin/quickstartoffice restart" >&2
	fi
	exit 0
fi

USER_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
if test -z "$USER_HOME" || ! test -d "$USER_HOME"; then
	USER_HOME="/home/$TARGET_USER"
fi

# 标准路径为 Kingsoft；个别环境仅生成小写 kingsoft（大小写敏感），两处都写入以免漏读
for DEST in \
	"$USER_HOME/.local/share/Kingsoft/wps/jsaddons" \
	"$USER_HOME/.local/share/kingsoft/wps/jsaddons"
do
	mkdir -p "$DEST"
	# 安装前先清理历史版本目录，装完只剩最新版本
	cleanup_old_addons "$DEST"
	install_all "$DEST"
	cp -f "$INSTALL_ROOT/publish.xml" "$DEST/"
	merge_publish_online "$DEST/publish.xml"
	sync_jsplugins "$DEST"
	for FOLDER in "$ADDON_FOLDER" $HOST_FOLDERS; do
		test -d "$DEST/$FOLDER" && chown -R "$TARGET_USER:$TARGET_USER" "$DEST/$FOLDER" 2>/dev/null || true
	done
	chown "$TARGET_USER:$TARGET_USER" "$DEST/publish.xml" 2>/dev/null || true
	cleanup_old_addons "$DEST"
	echo "chayuan-wps-addon: installed to $DEST"
done

# WPS 某些布局会把系统 office6/jsaddons 镜像到用户目录（实测 Kasm WPS 12.1.2 存在
# ~/.local/share/Kingsoft/office6/jsaddons，且任务窗格按这里注册的版本解析）。
# 旧版本残留会让升级后任务窗格解析到已删除目录 → 白屏。只在镜像已存在时同步，
# 不主动新建（避免给未启用该布局的环境引入多余注册源）。大小写两种拼法都覆盖。
for MIRROR in \
	"$USER_HOME/.local/share/Kingsoft/office6/jsaddons" \
	"$USER_HOME/.local/share/kingsoft/office6/jsaddons"
do
	test -d "$MIRROR" || continue
	cleanup_old_addons "$MIRROR"
	install_all "$MIRROR" || true
	if test -f "$MIRROR/jsplugins.xml" || test -f "$MIRROR/publish.xml"; then
		cp -f "$INSTALL_ROOT/publish.xml" "$MIRROR/" || true
		merge_publish_online "$MIRROR/publish.xml"
	fi
	sync_jsplugins "$MIRROR"
	# office6 根目录还可能残留 wpsjs 调试期的 chayuan 注册（enable_dev / 127.0.0.1 在线条目，
	# 指向早已不存在的目录/端口），一并剔除，避免干扰正式加载项目录的解析。
	for STALE in "$MIRROR/../jsplugins.xml" "$MIRROR/../publish.xml"; do
		test -f "$STALE" || continue
		grep -q 'name="chayuan' "$STALE" || continue
		sed -i '/name="chayuan/d' "$STALE" 2>/dev/null || true
		echo "chayuan-wps-addon: scrubbed stale chayuan entries from $STALE"
	done
	for FOLDER in "$ADDON_FOLDER" $HOST_FOLDERS; do
		test -d "$MIRROR/$FOLDER" && chown -R "$TARGET_USER:$TARGET_USER" "$MIRROR/$FOLDER" 2>/dev/null || true
	done
	cleanup_old_addons "$MIRROR"
	echo "chayuan-wps-addon: synced office6 mirror $MIRROR"
done

# authaddin.json 的幽灵记录清理（含大小写两种布局下的既有文件）
for AA_DEST in \
	"$USER_HOME/.local/share/Kingsoft/wps/jsaddons" \
	"$USER_HOME/.local/share/kingsoft/wps/jsaddons" \
	"$USER_HOME/.local/share/Kingsoft/office6/jsaddons" \
	"$USER_HOME/.local/share/kingsoft/office6/jsaddons"
do
	refresh_authaddin "$AA_DEST"
done

if test -x "/opt/apps/cn.wps.wps-office-pro/files/bin/quickstartoffice"; then
	echo "chayuan-wps-addon: 若未看到加载项，请执行: /opt/apps/cn.wps.wps-office-pro/files/bin/quickstartoffice restart" >&2
fi

# Phase 2+: install MCP sidecar user autostart (best-effort; needs node)
# 升级防呆（对齐 Windows 安装器 1472ded）：旧 sidecar 可能仍在运行，持有旧逻辑；
# 先停旧进程再强拷贝，装完由 autostart 拉起新版，避免"装了新包跑旧 sidecar"。
MCP_SRC="$INSTALL_ROOT/$ADDON_FOLDER/mcp-sidecar"
if test -d "$MCP_SRC" && test -n "$TARGET_USER" && test "$TARGET_USER" != "root"; then
	MCP_HOME="$USER_HOME/.config/chayuan-wps/mcp"
	pkill -f "chayuan-wps/mcp/runtime/bin/chayuan-mcp" 2>/dev/null || true
	sleep 1
	mkdir -p "$MCP_HOME/runtime"
	cp -a "$MCP_SRC/." "$MCP_HOME/runtime/" 2>/dev/null || true
	cp -f "$MCP_SRC/bin/"chayuan-mcp-linux-* "$MCP_HOME/runtime/bin/" 2>/dev/null || true
	# 确保 sidecar 单文件二进制可执行（cp 可能丢位）
	if test -d "$MCP_HOME/runtime/bin"; then
		chmod 0755 "$MCP_HOME/runtime/bin/"* 2>/dev/null || true
	fi
	chown -R "$TARGET_USER:$TARGET_USER" "$MCP_HOME" 2>/dev/null || true
	if test -x "$MCP_HOME/runtime/autostart/install-linux-user.sh"; then
		su - "$TARGET_USER" -c "CHAYUAN_MCP_HOME=$MCP_HOME/runtime bash $MCP_HOME/runtime/autostart/install-linux-user.sh" 2>/dev/null \
			|| echo "chayuan-wps-addon: MCP autostart skipped (run $MCP_HOME/runtime/autostart/install-linux-user.sh as user)" >&2
	fi
	echo "chayuan-wps-addon: MCP sidecar staged at $MCP_HOME/runtime (URL http://127.0.0.1:62588/mcp)"
fi

exit 0
