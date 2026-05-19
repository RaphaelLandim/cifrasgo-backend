package com.cifrasgo.app;

import android.content.Intent;
import android.content.ClipData;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {
    private static final Pattern URL_PATTERN = Pattern.compile("https?://\\S+");
    private static final String TAG = "CifrasGoShare";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        Intent normalizedIntent = normalizeIncomingIntent(getIntent(), "onCreate");
        setIntent(normalizedIntent);
        super.onCreate(savedInstanceState);
        emitIncomingImportUrl(normalizedIntent, "onCreate");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        Intent normalizedIntent = normalizeIncomingIntent(intent, "onNewIntent");
        setIntent(normalizedIntent);
        super.onNewIntent(normalizedIntent);
        emitIncomingImportUrl(normalizedIntent, "onNewIntent");
    }

    private Intent normalizeIncomingIntent(Intent intent, String source) {
        String sharedUrl = extractSharedUrl(intent);
        if (sharedUrl == null) return intent;

        Log.d(TAG, "Received shared URL from " + source + ": " + sharedUrl);

        Intent normalizedIntent = new Intent(intent);
        normalizedIntent.setAction(Intent.ACTION_VIEW);
        normalizedIntent.setData(Uri.parse(sharedUrl));
        normalizedIntent.putExtra(Intent.EXTRA_TEXT, sharedUrl);
        return normalizedIntent;
    }

    private void emitIncomingImportUrl(Intent intent, String source) {
        String value = extractSharedUrl(intent);
        if (value == null && intent != null && Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
            value = intent.getData().toString();
        }
        if (value == null) return;

        final String incomingValue = value;
        final String eventSource = "android-" + source;
        int[] delays = new int[] { 0, 500, 1500, 3000 };

        for (int delay : delays) {
            mainHandler.postDelayed(() -> dispatchIncomingImportUrl(incomingValue, eventSource), delay);
        }
    }

    private void dispatchIncomingImportUrl(String value, String source) {
        if (getBridge() == null || getBridge().getWebView() == null) return;

        String eventPayload =
            "{ text: " +
            JSONObject.quote(value) +
            ", source: " +
            JSONObject.quote(source) +
            ", receivedAt: Date.now() }";
        String js =
            "(function(){ var detail = " +
            eventPayload +
            "; window.__cifrasgoPendingImportUrl = detail;" +
            "try { window.sessionStorage.setItem('cifrasgoPendingImportUrl', JSON.stringify(detail)); } catch (e) {}" +
            "window.dispatchEvent(new CustomEvent('cifrasgoIncomingImportUrl', { detail: detail })); })();";

        Log.d(TAG, "Dispatching shared URL to WebView from " + source + ": " + value);
        getBridge().getWebView().evaluateJavascript(js, null);
    }

    private String extractSharedUrl(Intent intent) {
        if (intent == null) return null;

        if (Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
            return cleanupUrl(intent.getData().toString());
        }

        if (!Intent.ACTION_SEND.equals(intent.getAction())) return null;

        String text = firstNonEmpty(
            charSequenceToString(intent.getCharSequenceExtra(Intent.EXTRA_TEXT)),
            intent.getStringExtra(Intent.EXTRA_HTML_TEXT),
            intent.getStringExtra(Intent.EXTRA_SUBJECT),
            intent.getStringExtra(Intent.EXTRA_TITLE),
            intent.getDataString(),
            extractTextFromClipData(intent.getClipData())
        );

        if (text == null) {
            Log.d(TAG, "ACTION_SEND received without text payload");
            return null;
        }

        Matcher matcher = URL_PATTERN.matcher(text);
        String url = matcher.find() ? matcher.group() : text;
        url = cleanupUrl(url);

        String lowerUrl = url.toLowerCase();
        if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) return null;

        return url;
    }

    private String cleanupUrl(String value) {
        if (value == null) return "";
        return value.trim().replaceAll("[)\\].,;!?]+$", "");
    }

    private String charSequenceToString(CharSequence value) {
        return value == null ? null : value.toString();
    }

    private String firstNonEmpty(String... values) {
        for (String value : values) {
            if (value == null) continue;
            String trimmed = value.trim();
            if (!trimmed.isEmpty()) return trimmed;
        }
        return null;
    }

    private String extractTextFromClipData(ClipData clipData) {
        if (clipData == null || clipData.getItemCount() == 0) return null;

        for (int i = 0; i < clipData.getItemCount(); i++) {
            ClipData.Item item = clipData.getItemAt(i);
            if (item == null) continue;

            CharSequence text = item.getText();
            if (text != null && text.length() > 0) return text.toString();

            CharSequence htmlText = item.getHtmlText();
            if (htmlText != null && htmlText.length() > 0) return htmlText.toString();

            Uri uri = item.getUri();
            if (uri != null) return uri.toString();
        }

        return null;
    }
}
