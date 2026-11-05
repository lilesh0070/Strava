package expo.modules.instagramstory

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val INSTAGRAM = "com.instagram.android"
private const val ADD_TO_STORY = "com.instagram.share.ADD_TO_STORY"

/**
 * Opens Instagram's story editor with a sticker (a transparent PNG) on top of a background the user
 * then picks, using Instagram's documented "Sharing to Stories" intent. Instagram requires the
 * sharing app's Facebook App ID in `source_application`.
 */
class InstagramStoryModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("InstagramStory")

    Function("isInstagramInstalled") {
      try {
        context.packageManager.getPackageInfo(INSTAGRAM, 0)
        true
      } catch (_: PackageManager.NameNotFoundException) {
        false
      }
    }

    /** Returns false when Instagram can't take the story (not installed or too old). */
    Function("shareStickerToStory") { stickerContentUri: String, facebookAppId: String, topColor: String, bottomColor: String ->
      val activity = appContext.throwingActivity
      val sticker = Uri.parse(stickerContentUri)
      val intent = Intent(ADD_TO_STORY).apply {
        type = "image/png"
        setPackage(INSTAGRAM)
        putExtra("source_application", facebookAppId)
        putExtra("interactive_asset_uri", sticker)
        putExtra("top_background_color", topColor)
        putExtra("bottom_background_color", bottomColor)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      if (activity.packageManager.resolveActivity(intent, 0) == null) {
        return@Function false
      }
      // the sticker is passed as an extra, so read access has to be granted to Instagram explicitly
      activity.grantUriPermission(INSTAGRAM, sticker, Intent.FLAG_GRANT_READ_URI_PERMISSION)
      activity.startActivity(intent)
      true
    }
  }
}
