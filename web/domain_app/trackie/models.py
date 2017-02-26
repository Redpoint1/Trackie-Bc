""" Domain specific DB models """

import django.contrib.gis.db.models as db_models
import django.contrib.auth.models as auth_model
import django.contrib.postgres.fields as postgres_fields

from django.utils.translation import ugettext_lazy as _


class SportType(db_models.Model):
    """ Sport type """

    class Meta:  # pylint: disable=missing-docstring,no-init,old-style-class
        verbose_name = _("Sport type")
        verbose_name_plural = _("Sport types")

    name = db_models.CharField(
        blank=False,
        null=False,
        unique=True,
        max_length=255,
        verbose_name=_("Sport name"),
        help_text=_("Name of the sport"),
    )

    slug = db_models.SlugField(
        blank=False,
        null=False,
        unique=True,
        max_length=255,
        verbose_name=_("Slug"),
        help_text=_("Name for the API"),
    )

    icon = db_models.ImageField(
        upload_to="static/images/sport/",
        null=True,
        blank=True,
        verbose_name=_("Icon"),
        help_text=_("Choose icon"),
    )

    def __str__(self):
        return self.name


class Tournament(db_models.Model):
    """ Tournament DB model """

    class Meta:  # pylint: disable=missing-docstring,no-init,old-style-class
        verbose_name = _("Tournament")
        verbose_name_plural = _("Tournaments")

    name = db_models.CharField(
        null=False,
        blank=False,
        max_length=255,
        verbose_name=_("Name"),
        help_text=_("Name of the Tournament"),
    )

    slug = db_models.SlugField(
        null=False,
        blank=False,
        max_length=255,
        verbose_name=_("Slug"),
        help_text=_("Name for the API"),
    )

    owner = db_models.ForeignKey(
        auth_model.User,
        null=False,
        blank=False,
        on_delete=db_models.CASCADE,
        related_name="tournaments",
        verbose_name=_("Owner"),
        help_text=_("Administrator of the Tournament"),
    )

    sport = db_models.ForeignKey(
        SportType,
        null=True,
        blank=False,
        on_delete=db_models.SET_NULL,
        related_name="tournaments",
        verbose_name=_("Sport"),
        help_text=_("Type of the sport of the tournament"),
    )

    def __str__(self):
        return self.name


class RaceType(db_models.Model):
    """ Race type """

    class Meta:  # pylint: disable=missing-docstring,no-init,old-style-class
        verbose_name = _("Race type")
        verbose_name_plural = _("Race types")

    name = db_models.CharField(
        blank=False,
        null=False,
        unique=True,
        max_length=255,
        verbose_name=_("Race type"),
        help_text=_("Type of the race"),
    )

    slug = db_models.SlugField(
        blank=False,
        null=False,
        unique=True,
        max_length=255,
        verbose_name=_("Slug"),
        help_text=_("Name for the API"),
    )

    icon = db_models.ImageField(
        upload_to="static/images/race/",
        null=True,
        blank=True,
        verbose_name=_("Icon"),
        help_text=_("Choose icon"),
    )

    def __str__(self):
        return self.name


class Track(db_models.Model):
    """ Track """

    class Meta:  # pylint: disable=missing-docstring,no-init,old-style-class
        verbose_name = _("Track")
        verbose_name_plural = _("Tracks")

    name = db_models.CharField(
        blank=False,
        null=False,
        unique=False,
        max_length=255,
        verbose_name=_("Track name"),
    )

    owner = db_models.ForeignKey(
        auth_model.User,
        null=True,
        blank=False,
        on_delete=db_models.SET_NULL,
        related_name="tracks",
        verbose_name=_("Owner"),
    )

    file = db_models.FileField(
        upload_to="maps/",
        help_text=_("The file can't be changed")
    )

    public = db_models.BooleanField(
        default=False,
        verbose_name=_("Public"),
    )

    def __str__(self):
        return self.name


class Racer(db_models.Model):
    """ Racer """

    class Meta:  # pylint: disable=missing-docstring,no-init,old-style-class
        verbose_name = _("Racer")
        verbose_name_plural = _("Racers")

    first_name = db_models.CharField(
        null=False,
        blank=False,
        max_length=255,
        verbose_name=_("First name"),
    )

    last_name = db_models.CharField(
        null=False,
        blank=False,
        max_length=255,
        verbose_name=_("Last name"),
    )

    def __str__(self):
        return "{} {}".format(self.first_name, self.last_name)


class Projection(db_models.Model):
    """ Projection """

    class Meta:  # pylint: disable=missing-docstring,no-init,old-style-class
        verbose_name = _("Projection")
        verbose_name_plural = _("Projections")

    code = db_models.CharField(
        null=False,
        blank=False,
        max_length=255,
        unique=True,
    )

    def __str__(self):
        return self.code


class Race(db_models.Model):
    """ Race """

    class Meta:  # pylint: disable=missing-docstring,no-init,old-style-class
        verbose_name = _("Race")
        verbose_name_plural = _("Races")

    name = db_models.CharField(
        null=False,
        blank=False,
        max_length=255,
        verbose_name=_("Name"),
        help_text=_("Name of the race"),
    )

    tournament = db_models.ForeignKey(
        Tournament,
        null=False,
        blank=False,
        related_name="races",
        verbose_name=_("Tournament"),
        help_text=_("Select under which tournament is assigned"),
    )

    type = db_models.ForeignKey(
        RaceType,
        null=True,
        blank=False,
        on_delete=db_models.SET_NULL,
        related_name="races",
        verbose_name=_("Type"),
        help_text=_("Determine race type"),
    )

    track = db_models.ForeignKey(
        Track,
        null=True,
        blank=False,
        on_delete=db_models.SET_NULL,
        related_name="races",
        verbose_name=_("Track"),
        help_text=_("Select track map"),
    )

    start = db_models.DateTimeField(
        null=False,
        blank=False,
        verbose_name=_("Begins at"),
    )

    end = db_models.DateTimeField(
        null=True,
        blank=True,
    )

    estimated_duration = db_models.IntegerField(
        null=True,
        blank=False,
        verbose_name=_("Estimated duration"),
        help_text=_("In minutes")
    )

    projection = db_models.ForeignKey(
        Projection,
        null=True,
        blank=True,
        on_delete=db_models.SET_NULL,
        verbose_name=_("Projection"),
        help_text=_("Default is {}").format("EPSG:3857"),
    )

    participants = db_models.ManyToManyField(
        Racer,
        blank=False,
        through="RacerInRace",
        through_fields=("race", "racer"),
    )

    def __str__(self):
        return self.name


class RaceData(db_models.Model):
    """ Race Data """

    race = db_models.ForeignKey(
        Race,
        null=True,
        blank=False,
        on_delete=db_models.CASCADE,
        related_name="data",
    )

    received = db_models.DateTimeField(
        null=False,
        blank=False,
    )

    racer = db_models.ForeignKey(
        Racer,
        null=False,
        blank=False,
        on_delete=db_models.DO_NOTHING,
    )

    position = db_models.PointField()

    data = postgres_fields.JSONField()


class RacerInRace(db_models.Model):
    """ Racer in a race """

    racer = db_models.ForeignKey(
        Racer,
        null=False,
        blank=False,
        on_delete=db_models.CASCADE,
        related_name="races",
    )

    race = db_models.ForeignKey(
        Race,
        null=False,
        blank=False,
        on_delete=db_models.CASCADE,
        related_name="racers",
    )

    number = db_models.IntegerField()